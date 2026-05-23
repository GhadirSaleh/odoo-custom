/** @odoo-module **/

/**
 * Auto-Enable Invoice on New Orders
 * ==================================
 * Patches: PosOrder.setup
 *
 * Problem: By default, the POS does not generate invoices for orders unless
 * the cashier manually toggles the invoice button. For this business, every
 * order should have an invoice by default.
 *
 * Solution: Patch PosOrder.setup to set `this.to_invoice = true` when the
 * POS configuration allows invoicing (canInvoice is enabled).
 *
 * Note: This only affects new orders. Existing orders retain their original
 * to_invoice state.
 */

import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";

patch(PosOrder.prototype, {
    setup(vals) {
        super.setup(vals);
        // Make invoice button active by default if config allows invoicing
        if (this.config && this.config.canInvoice) {
            this.to_invoice = true;
        }
    },
});
