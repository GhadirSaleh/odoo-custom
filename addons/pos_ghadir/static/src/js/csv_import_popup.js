/**
 * @odoo-module
 *
 * CSV Product Import — 3-Step Wizard Popup
 * ==========================================
 *
 * Steps:
 *   1. **Mapping** — For each CSV header, the user selects an Odoo field
 *      from a dropdown. Auto-detection (longest-pattern match via AUTO_MAP)
 *      pre-selects most columns.
 *   2. **Preview** — Validates all rows (dry-run), shows create/update action
 *      and per-row error count. User can go back to fix mapping.
 *   3. **Result** — Summary of created/updated/orderpoints/errors.
 *      Close button triggers full POS reload (reloadData(true)).
 *
 * Communication with server uses type='json' routes, so all fetch bodies
 * are wrapped in {params: {...}}.
 *
 * Gotchas:
 *   - _t is stored in this._t via setup() because Owl template scope
 *     does not inherit the imported _t symbol.
 *   - t-key uses "header + '_' + header_index" to avoid Owl duplicate-key
 *     errors when CSV has repeated column headers.
 *   - Arrow class field (setMapping = ...) ensures correct 'this' binding
 *     in template event handlers.
 *   - makeAwaitable import was removed in favor of inline Promise/close
 *     callback to avoid redeclaration errors.
 */

import { Component } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";

const AUTO_MAP = [
    { field: "name",          patterns: ["name", "product name", "product", "item", "الاسم"] },
    { field: "default_code",  patterns: ["sku", "code", "reference", "ref", "default_code", "كود"] },
    { field: "list_price",      patterns: ["price", "list price", "sale price", "سعر"] },
    { field: "standard_price",  patterns: ["cost", "التكلفة", "standard price"] },
    { field: "categ_id",     patterns: ["category", "cat", "product category", "categ", "قسم"] },
    { field: "available_in_pos", patterns: ["available in pos", "pos available", "available", "in pos", "yes", "no"] },
    { field: "active",       patterns: ["active", "is active", "enabled", "status", "مفعل"] },
    { field: "pos_categ_ids",patterns: ["pos category", "pos cat", "pos_categ"] },
    { field: "uom_id",       patterns: ["uom", "unit", "uom_id", "unit of measure", "measure", "وحدة"] },
    { field: "seller_id",    patterns: ["vendor", "supplier", "seller", "available vendor", "مورد"] },
    { field: "reorder_min",  patterns: ["min qty", "product min qty", "minimum qty", "min quantity", "product min", "min", "حد أدنى"] },
    { field: "reorder_max",  patterns: ["max qty", "product max qty", "maximum qty", "max quantity", "product max", "max", "حد أقصى"] },
];

/**
 * Auto-detect the best Odoo field for a CSV header using longest-pattern
 * matching against AUTO_MAP.
 *
 * Short patterns (≤3 chars, e.g. "min", "max", "sku") match exactly only
 * to prevent false startsWith matches (e.g. "Admin" matching "min").
 * Longer patterns use startsWith for flexible matching.
 *
 * Among all matching patterns, the longest one wins, so "product name"
 * overrides "product" and "product min qty" overrides "min".
 *
 * @param {string} header - CSV column header (case-insensitive).
 * @param {object} fieldOptions - Available field keys from server.
 * @returns {string} Matched field name or "__skip__" if no match.
 */
function autoDetect(header, fieldOptions) {
    const h = header.toLowerCase().trim();
    let bestField = null;
    let bestLen = 0;
    for (const entry of AUTO_MAP) {
        if (!fieldOptions.hasOwnProperty(entry.field)) continue;
        for (const pat of entry.patterns) {
            const matches = pat.length <= 3 ? h === pat : (h.startsWith(pat) || h === pat);
            if (matches) {
                if (pat.length > bestLen) {
                    bestField = entry.field;
                    bestLen = pat.length;
                }
            }
        }
    }
    return bestField || "__skip__";
}

export class CsvImportPopup extends Component {
    static template = "pos_ghadir.CsvImportPopup";
    static components = { Dialog };
    static props = {
        close: Function,
        getPayload: { type: Function, optional: true },
        csvHeaders: { type: Array },
        csvContent: { type: String },
    };

    setup() {
        this._t = _t;
        this.state = {
            step: "loading",
            headers: this.props.csvHeaders,
            fieldOptions: {},
            mapping: {},
            previewRows: [],
            previewErrors: [],
            result: null,
        };
        this._loadFieldOptions();
    }

    /**
     * Fetch available Odoo field options from the server, then auto-detect
     * mapping for each CSV header.
     */
    async _loadFieldOptions() {
        try {
            const resp = await fetch("/pos_ghadir/import_fields", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({params: {}}),
            });
            const data = (await resp.json()).result || {};
            this.state.fieldOptions = data.fields || {};
            const mapping = {};
            for (const header of this.props.csvHeaders) {
                mapping[header] = autoDetect(header, data.fields || {});
            }
            this.state.mapping = mapping;
            this.state.step = "mapping";
            this.render();
        } catch (err) {
            this.state.step = "mapping";
            this.state.fieldOptions = {};
            this.render();
        }
    }

    /** Arrow class field: update the mapping for a given CSV header. */
    setMapping = (header, field) => {
        this.state.mapping[header] = field;
    }

    /**
     * Step 2: Run a preview (dry-run validation) against the server.
     * Switches to "preview" step showing per-row validation results.
     */
    async preview() {
        this.state.step = "loading";
        this.render();

        try {
            const resp = await fetch("/pos_ghadir/import_products_csv", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({params: {
                    csv_content: this.props.csvContent,
                    mapping: this.state.mapping,
                    preview: true,
                }}),
            });
            const data = (await resp.json()).result || {};

            if (data.error) {
                this.state.step = "mapping";
                this.render();
                alert("Error: " + data.error);
                return;
            }

            this.state.previewRows = data.preview || [];
            this.state.previewErrors = (data.preview || []).filter(r => r.has_errors);
            this.state.step = "preview";
            this.render();
        } catch (err) {
            this.state.step = "mapping";
            this.render();
            alert("Preview failed: " + (err.message || String(err)));
        }
    }

    /**
     * Step 3: Execute the actual import (upsert products, create orderpoints).
     * Shows a result summary. On error, returns to preview step.
     */
    async doImport() {
        this.state.step = "loading";
        this.render();

        try {
            const resp = await fetch("/pos_ghadir/import_products_csv", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({params: {
                    csv_content: this.props.csvContent,
                    mapping: this.state.mapping,
                    preview: false,
                }}),
            });
            const data = (await resp.json()).result || {};

            if (data.error) {
                this.state.step = "preview";
                this.render();
                alert("Import error: " + data.error);
                return;
            }

            this.state.result = data;
            this.state.step = "done";
            this.render();
        } catch (err) {
            this.state.step = "preview";
            this.render();
            alert("Import failed: " + (err.message || String(err)));
        }
    }

    /** Navigate back from preview to the mapping step. */
    back() {
        this.state.step = "mapping";
        this.render();
    }

    /**
     * Close the popup and trigger a full POS data reload.
     * Matches the reloadData(true) pattern used by the exchange rate setter.
     */
    close() {
        this.props.getPayload?.();
        this.props.close();
        if (window.posmodel?.reloadData) {
            setTimeout(() => window.posmodel.reloadData(true), 200);
        }
    }
}
