"""
Price Catalog Report — Landscape A4 PDF of POS products by category
====================================================================
Generates a compact multi-column PDF listing all products available in POS
with their prices from a given pricelist. Products are grouped by category,
sorted by most-populous categories first, and laid out in 7 columns per row.

Categories that exceed MAX_ITEMS_PER_COL are automatically split across
multiple adjacent columns with "(1/2)", "(2/3)" etc. labels to prevent
mid-category page breaks.

The report is triggered from the POS hamburger dropdown menu via
`/report/pdf/pos_ghadir.price_catalog/<pricelist_id>`. Uses the standard
Odoo QWeb PDF rendering pipeline with a custom A4 landscape paperformat
(zero margins, no header/footer).
"""

import datetime
import math

from odoo import api, models

# Max items rendered inside a single column. Categories with more
# items than this are split across adjacent columns. Tuned for A4
# landscape at 110 DPI (~35 rows fit comfortably; 30 leaves margin).
MAX_ITEMS_PER_COL = 30


class ReportPriceCatalog(models.AbstractModel):
    _name = 'report.pos_ghadir.price_catalog'
    _description = 'Price Catalog Report'

    @api.model
    def _get_report_values(self, docids, data=None):
        pricelist = self.env['product.pricelist'].browse(docids)
        if not pricelist:
            pricelist = self.env['product.pricelist'].search([], limit=1)

        company = self.env.company
        date = datetime.date.today()

        products = self.env['product.product'].search([
            ('available_in_pos', '=', True),
            ('sale_ok', '=', True),
        ], order='categ_id, name')

        # Build category data preserving insertion order
        category_data = []
        seen_categories = {}
        for product in products:
            cat = product.categ_id
            if cat.id not in seen_categories:
                seen_categories[cat.id] = {
                    'name': cat.display_name or cat.name,
                    'items': [],
                }
                category_data.append(seen_categories[cat.id])
            raw_price = pricelist._get_product_price(product, 1.0)
            formatted_price = self._format_price(raw_price)
            seen_categories[cat.id]['items'].append({
                'name': product.name,
                'price': formatted_price,
            })

        # Alternating row parity for zebra striping
        for cat in category_data:
            for idx, item in enumerate(cat['items']):
                item['parity'] = 'odd' if idx % 2 == 0 else 'even'

        # Split oversized categories into multi-column chunks so that no
        # single column exceeds MAX_ITEMS_PER_COL. This prevents ugly
        # mid-table page breaks in the PDF.
        split_data = []
        for cat in category_data:
            items = cat['items']
            if len(items) > MAX_ITEMS_PER_COL:
                n_chunks = math.ceil(len(items) / MAX_ITEMS_PER_COL)
                chunk_size = math.ceil(len(items) / n_chunks)
                for i in range(n_chunks):
                    chunk_items = items[i * chunk_size:(i + 1) * chunk_size]
                    # Re-apply zebra parity within each chunk
                    for idx, item in enumerate(chunk_items):
                        item['parity'] = 'odd' if idx % 2 == 0 else 'even'
                    suffix = '' if n_chunks == 1 else f' ({i + 1}/{n_chunks})'
                    split_data.append({
                        'name': cat['name'] + suffix,
                        'items': chunk_items,
                    })
            else:
                split_data.append(cat)
        category_data = split_data

        # Sort categories by item count descending, group into rows of 7
        category_data.sort(key=lambda c: len(c['items']), reverse=True)
        category_rows = []
        for i in range(0, len(category_data), 7):
            row = category_data[i:i + 7]
            category_rows.append(row)

        return {
            'doc_ids': docids,
            'doc_model': 'product.pricelist',
            'docs': pricelist,
            'pricelist': pricelist,
            'company': company,
            'date': date,
            'category_rows': category_rows,
        }

    def _format_price(self, price):
        """Format a numeric price as a locale-string integer (no decimals, no
        currency symbol). Returns '0' for falsy values."""
        if not price:
            return '0'
        rounded = round(price)
        return '{:,}'.format(rounded)
