"""POS CSV Product Import — Controller

Dynamically discovers importable fields from the product.template model
so any CSV column can map to any product field. Supports:

- Preview mode (validates without writing) for dry-run safety checks
- Import mode (upserts products by SKU, then by name)
- Auto-detection: client-side longest-pattern algorithm (see AUTO_MAP in
  csv_import_popup.js). Server also returns all field options for manual
  mapping in the dropdown.
- Virtual fields: reorder_min/max (creates stock.warehouse.orderpoint),
  seller_id (creates supplier info) — vendor is auto-created as a minimal
  partner record if the name doesn't exist in the DB, with a warning shown
  in the preview step. pos_categ_ids (assigns POS categories).
- Blank-cell clearing: type-appropriate empty values (0/' '/False) are
  written to the DB so the field is zeroed/cleared, not skipped.
- Full POS reload on Close to pick up imported products.

Uses type='json' (JSON-RPC) for natural JSON request/response.
"""

import csv
import io
from datetime import datetime

from odoo import http
from odoo.http import request

# -- Field filtering constants ------------------------------------------------
# These control which product.template fields appear in the mapping dropdown.

SKIP_FIELD_TYPES = {'binary', 'one2many', 'many2many', 'properties'}
"""Field types excluded from CSV import (can't be meaningfully set from CSV)."""

SKIP_FIELD_NAMES = {
    'id', 'display_name', '__last_update',
    'create_uid', 'create_date', 'write_uid', 'write_date',
    'product_variant_id', 'product_variant_ids', 'product_variant_count',
    'import_attribute_values', 'variant_seller_ids',
    'can_image_1024_be_zoomed',
    'has_available_route_ids', 'has_configurable_attributes',
    'has_message', 'is_dynamically_created', 'is_favorite',
    'is_product_variant',
    'image_128', 'image_256', 'image_512', 'image_1024', 'image_1920',
    'product_properties',
    'reordering_min_qty', 'reordering_max_qty', 'nbr_reordering_rules',
}
"""Individual field names excluded (internal/system, or duplicates of virtual)."""

SKIP_FIELD_PREFIXES = ('message_', 'activity_', 'my_activity_')
"""Prefixes that mark fields as internal chatter/activity tracking."""


def _get_importable_fields(env):
    """Return dict of {field_name: field_info} for product.template fields
    suitable for CSV import.

    Filters out internal/system fields and types that can't be meaningfully
    set from CSV row data (binary, one2many, many2many, properties).

    Returns:
        dict: {field_name: fields_get_info_dict}
    """
    fields = env['product.template'].fields_get()
    result = {}
    for fname, finfo in fields.items():
        if finfo['type'] in SKIP_FIELD_TYPES:
            continue
        if fname in SKIP_FIELD_NAMES:
            continue
        if any(fname.startswith(p) for p in SKIP_FIELD_PREFIXES):
            continue
        result[fname] = finfo
    return result


def _convert_value(env, field_name, raw_value, field_types):
    """Convert a CSV string to the appropriate Python type for the field.

    Handles all importable field types (char, boolean, integer, float,
    many2one, date, datetime, selection, text, html).

    **Blank-cell clearing**: when the CSV cell is empty, returns the
    type-appropriate empty/zero value (0 for numbers, False for booleans
    and relations, '' for char/text) instead of None. This causes the
    field to be *written* to the DB, effectively clearing/zeroing it
    rather than leaving the old value untouched.

    **Conversion failures**: if the value can't be parsed (e.g. "abc"
    for a float), returns None so the field is skipped in the final
    write.

    Args:
        env: Odoo environment (for many2one lookups).
        field_name: The Odoo field name (e.g. 'list_price').
        raw_value: Raw string from the CSV cell (may be '' or None).
        field_types: fields_get output dict for type/relation info.

    Returns:
        Converted Python value, type-appropriate empty value, or None.
    """
    if raw_value is None:
        return None
    val = raw_value.strip()
    finfo = field_types.get(field_name, {})
    ftype = finfo.get('type', 'char')

    if not val:
        if ftype == 'boolean':
            return False
        elif ftype in ('integer', 'float'):
            return 0 if ftype == 'integer' else 0.0
        elif ftype in ('many2one', 'date', 'datetime'):
            return False
        else:
            return ''

    if ftype == 'boolean':
        return val.lower() in ('yes', 'true', '1', 't', 'on')
    elif ftype == 'integer':
        try:
            return int(val)
        except ValueError:
            return None
    elif ftype == 'float':
        try:
            return float(val.replace(',', '.'))
        except ValueError:
            return None
    elif ftype == 'many2one':
        rel = finfo.get('relation')
        if rel:
            rec = env[rel].search([('name', '=', val)], limit=1)
            if rec:
                return rec.id
        return None
    elif ftype == 'date':
        try:
            return datetime.strptime(val, '%Y-%m-%d').date()
        except ValueError:
            return None
    elif ftype == 'datetime':
        try:
            return datetime.strptime(val, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            return None
    else:
        return val


class ProductImportController(http.Controller):
    """Controller for POS-side CSV product import.

    Two routes:
      /pos_ghadir/import_fields  — returns available field options for the
                                   column-mapping dropdown (dynamic from model).
      /pos_ghadir/import_products_csv  — accepts CSV body + mapping, runs
                                         preview or actual import.

    Virtual fields (not real product.template fields but handled specially):
      reorder_min / reorder_max  — create/update stock.warehouse.orderpoint.
      seller_id                  — creates a supplier info (seller_ids) line.
      pos_categ_ids              — assigns POS categories (comma-separated
                                   names in the CSV cell).
    """

    VIRTUAL_FIELDS = {
        'reorder_min': 'Min Qty (Reorder)',
        'reorder_max': 'Max Qty (Reorder)',
        'seller_id': 'Vendor',
        'pos_categ_ids': 'POS Category',
    }
    """Virtual field labels shown in the mapping dropdown alongside real
    product.template fields. These are handled as special cases in
    _import_row() — they don't correspond to a real column on the model."""

    @http.route('/pos_ghadir/import_fields', type='json', auth='user')
    def field_options(self):
        """Return available field options for CSV column mapping.

        Combines dynamic product.template fields (filtered by
        _get_importable_fields) with the virtual fields (reorder_min,
        reorder_max, seller_id, pos_categ_ids).

        Returns:
            dict: {'fields': {field_key: label_string},
                   'required': ['name']}
        """
        env = request.env(su=True)
        fields = _get_importable_fields(env)
        result = {fname: finfo['string'] for fname, finfo in fields.items()}
        result.update(self.VIRTUAL_FIELDS)
        return {
            'fields': result,
            'required': ['name'],
        }

    @http.route('/pos_ghadir/import_products_csv', type='json', auth='user',
                methods=['POST'])
    def import_products_csv(self, csv_content=None, mapping=None,
                           preview=False):
        """Accept CSV content + column mapping, run preview or actual import.

        POST body (JSON-RPC wrapper: {'params': {...}}):
            csv_content (str): Full CSV text (header row + data rows).
            mapping (dict): {csv_header: odoo_field_name}, where '__skip__'
                            means the column is ignored.
            preview (bool): If True, validate only (dry-run). If False,
                            upsert products and create orderpoints.

        Returns:
            dict: {
                'created': int,
                'updated': int,
                'orderpoints': int,
                'errors': [str],
                'preview': [{row, name, sku, has_errors, errors, has_warnings,
                             warnings, action}]
            }
            On error: {'error': str}
        """
        env = request.env(su=True)

        if not csv_content:
            return {'error': 'No CSV data provided'}
        if not mapping:
            return {'error': 'No column mapping provided'}

        try:
            reader = csv.DictReader(io.StringIO(csv_content))
            field_types = _get_importable_fields(env)

            # Cached lookups used across all rows
            vendor = env['res.partner'].search(
                [('name', 'ilike', '%johny%')], limit=1)
            warehouse = env['stock.warehouse'].search(
                [('company_id', '=', env.company.id)], limit=1)
            route_buy = env['stock.route'].search(
                [('name', 'ilike', '%buy%')], limit=1)

            stats = {'created': 0, 'updated': 0, 'orderpoints': 0,
                     'errors': [], 'preview': []}

            for row_num, row in enumerate(reader, start=1):
                # Apply column mapping: CSV header -> Odoo field name
                mapped = {}
                for csv_header, odoo_field in mapping.items():
                    if odoo_field == '__skip__':
                        continue
                    val = row.get(csv_header, '')
                    if odoo_field not in mapped:
                        mapped[odoo_field] = val.strip()
                    elif val.strip():
                        mapped[odoo_field] = val.strip()

                name = mapped.get('name', '')
                sku = mapped.get('default_code', '')

                if preview:
                    errors, warnings = self._validate_row(
                        env, mapped, field_types)
                    stats['preview'].append({
                        'row': row_num,
                        'name': name,
                        'sku': sku,
                        'has_errors': bool(errors),
                        'errors': errors,
                        'has_warnings': bool(warnings),
                        'warnings': warnings,
                        'action': _guess_action(env, sku, name),
                    })
                else:
                    self._import_row(
                        env, mapped, field_types, vendor, warehouse,
                        route_buy, stats)

            return stats

        except Exception as e:
            return {'error': str(e)}

    def _validate_row(self, env, mapped, field_types):
        """Dry-run validation on one mapped row.

        Checks:
        - Name is present (required field).
        - Numeric fields (float/integer) parse correctly.
        - Many2one field values exist in their target model.
        - Boolean values are recognized.
        - Virtual fields (seller_id, pos_categ_ids) reference real records.
        - Missing vendors are reported as warnings (not errors) because the
          import will auto-create them.

        Args:
            env: Odoo environment.
            mapped (dict): {odoo_field_name: raw_csv_value}.
            field_types (dict): From _get_importable_fields() for type info.

        Returns:
            tuple (list[str], list[str]): Error messages and warning messages.
        """
        errors = []
        warnings = []
        name = mapped.get('name', '')
        if not name:
            errors.append('Missing product name')

        for field_name, raw_val in mapped.items():
            if field_name in ('name', 'default_code'):
                continue
            finfo = field_types.get(field_name)
            if not finfo:
                continue
            ftype = finfo['type']

            if not raw_val:
                continue

            if ftype == 'float':
                try:
                    float(raw_val.replace(',', '.'))
                except ValueError:
                    errors.append(f"Invalid number '{raw_val}' for {finfo['string']}")
            elif ftype == 'integer':
                try:
                    int(raw_val)
                except ValueError:
                    errors.append(f"Invalid integer '{raw_val}' for {finfo['string']}")
            elif ftype == 'many2one':
                rel = finfo.get('relation')
                if rel:
                    rec = env[rel].search([('name', '=', raw_val)], limit=1)
                    if not rec:
                        errors.append(f"Unknown '{raw_val}' in {finfo['string']}")
            elif ftype == 'boolean':
                if raw_val.lower() not in ('yes', 'true', '1', 't', 'no', 'false', '0', 'f', 'on', 'off', ''):
                    errors.append(f"Invalid boolean '{raw_val}' for {finfo['string']}")

        # Validate virtual fields — missing vendors become warnings (auto-created during import)
        if 'seller_id' in mapped and mapped['seller_id'].strip():
            vname = mapped['seller_id'].strip()
            if not env['res.partner'].search([('name', 'ilike', vname)], limit=1):
                warnings.append(f"Vendor '{vname}' not found — will be created automatically")
        if 'pos_categ_ids' in mapped and mapped['pos_categ_ids'].strip():
            for cname in (c.strip() for c in mapped['pos_categ_ids'].split(',') if c.strip()):
                if not env['pos.category'].search([('name', '=', cname)], limit=1):
                    errors.append(f"Unknown POS category '{cname}'")

        return errors, warnings

    def _import_row(self, env, mapped, field_types, vendor, warehouse,
                    route_buy, stats):
        """Upsert one product row from mapped CSV data.

        Lookup order: by SKU (default_code), then by name on
        product.product, then by name on product.template.

        Builds a generic tvals dict from all mapped fields (using
        _convert_value for type conversion), then handles special cases:

        - Seller (vendor): creates supplier_info line if seller_id mapped
          or fallback vendor found.
        - POS categories: assigns via many2many commands.
        - Reorder min/max: creates/updates stock.warehouse.orderpoint.

        Args:
            env: Odoo environment.
            mapped (dict): {odoo_field_name: raw_csv_value}.
            field_types (dict): fields_get info for type conversion.
            vendor: Default res.partner for fallback supplier creation.
            warehouse: stock.warehouse for orderpoint location.
            route_buy: Buy route for auto-purchase products.
            stats (dict): Accumulator mutated in-place (created, updated,
                          orderpoints, errors).
        """
        name = mapped.get('name', '')
        if not name:
            return

        try:
            sku = mapped.get('default_code', '')

            # Track whether reorder columns are mapped (empty = clear to 0)
            reorder_min_raw = mapped.get('reorder_min')
            reorder_max_raw = mapped.get('reorder_max')
            min_present = 'reorder_min' in mapped
            max_present = 'reorder_max' in mapped
            has_reorder = min_present or max_present
            min_qty = float(reorder_min_raw.replace(',', '.')) if min_present and reorder_min_raw.strip() else 0.0
            max_qty = float(reorder_max_raw.replace(',', '.')) if max_present and reorder_max_raw.strip() else 0.0

            # Find existing variant
            variant = None
            if sku:
                variant = env['product.product'].search(
                    [('default_code', '=', sku)], limit=1)
            if not variant:
                variant = env['product.product'].search(
                    [('name', '=', name)], limit=1)
            if not variant:
                tmpl = env['product.template'].search(
                    [('name', '=', name)], limit=1)
                if tmpl:
                    variant = tmpl.product_variant_id

            # Build values dict from all mapped fields (generic)
            tvals = {}
            for field_name, raw_val in mapped.items():
                if field_name in ('reorder_min', 'reorder_max', 'seller_id', 'pos_categ_ids'):
                    continue
                converted = _convert_value(
                    env, field_name, raw_val, field_types)
                if converted is not None:
                    tvals[field_name] = converted

            if route_buy:
                tvals['route_ids'] = [(4, route_buy.id)]

            # Handle seller_id (virtual) — lookup vendor by name, auto-create if missing
            if 'seller_id' in mapped and mapped['seller_id'].strip():
                vendor_name = mapped['seller_id'].strip()
                csv_vendor = env['res.partner'].search(
                    [('name', 'ilike', vendor_name)], limit=1)
                if not csv_vendor:
                    csv_vendor = env['res.partner'].create({
                        'name': vendor_name,
                        'supplier_rank': 1,
                    })
                if csv_vendor:
                    tvals['seller_ids'] = [(0, 0, {
                        'partner_id': csv_vendor.id,
                        'price': float(tvals.get('list_price', 0) or 0),
                        'min_qty': 0.0,
                    })]
            # Fallback: always set vendor if found (old behavior)
            if 'seller_ids' not in tvals and vendor:
                tvals['seller_ids'] = [(0, 0, {
                    'partner_id': vendor.id,
                    'price': float(tvals.get('list_price', 0) or 0),
                    'min_qty': 0.0,
                })]

            # Handle pos_categ_ids (virtual) — lookup POS categories by name
            if 'pos_categ_ids' in mapped and mapped['pos_categ_ids'].strip():
                cat_names = [c.strip() for c in mapped['pos_categ_ids'].split(',') if c.strip()]
                pos_cats = env['pos.category'].search([('name', 'in', cat_names)])
                if pos_cats:
                    tvals['pos_categ_ids'] = [(4, c.id) for c in pos_cats]

            if variant:
                variant.product_tmpl_id.write(tvals)
                if sku:
                    variant.write({'default_code': sku})
                stats['updated'] += 1
            else:
                if not sku:
                    sku = name
                tvals['default_code'] = sku
                tmpl = env['product.template'].create(tvals)
                variant = tmpl.product_variant_id
                stats['created'] += 1

            # Reordering rule (only when column was explicitly mapped)
            if warehouse and has_reorder and variant:
                loc = warehouse.lot_stock_id
                if loc:
                    op = env['stock.warehouse.orderpoint'].search([
                        ('product_id', '=', variant.id),
                        ('warehouse_id', '=', warehouse.id),
                    ], limit=1)
                    op_vals = {
                        'product_id': variant.id,
                        'product_min_qty': min_qty,
                        'product_max_qty': max_qty,
                        'warehouse_id': warehouse.id,
                        'location_id': loc.id,
                        'company_id': env.company.id,
                    }
                    if op:
                        op.write(op_vals)
                    else:
                        env['stock.warehouse.orderpoint'].create(op_vals)
                    stats['orderpoints'] += 1

        except Exception as e:
            stats['errors'].append(f"Row: {name} — {e}")


def _guess_action(env, sku, name):
    """Determine whether a row would Create or Update an existing product.

    Checks by SKU first (exact match on default_code), then by name
    (exact match on product.product name).

    Args:
        env: Odoo environment.
        sku (str): Product SKU from CSV (may be empty).
        name (str): Product name from CSV (may be empty).

    Returns:
        str: 'Update' if a match was found, 'Create' otherwise.
    """
    if sku:
        found = env['product.product'].search(
            [('default_code', '=', sku)], limit=1)
        if found:
            return 'Update'
    if name:
        found = env['product.product'].search(
            [('name', '=', name)], limit=1)
        if found:
            return 'Update'
    return 'Create'
