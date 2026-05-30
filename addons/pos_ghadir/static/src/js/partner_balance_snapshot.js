/** @odoo-module **/

/**
 * Partner Balance Snapshot — Restore Stored Balances on Load
 * ===========================================================
 * Patches: PosOrder.setup
 *
 * Problem: partnerBalance (used for حساب سابق) is normally set during the
 * POS session by partner_balance_fetcher.js. But when re-printing an old
 * receipt or reloading the POS, the balance is fetched live from accounting,
 * which reflects current state — not what it was when the order was placed.
 *
 * Solution: The backend now stores partner_previous_balance on the pos.order
 * record at creation time. This patch reads that stored value and sets it
 * as partnerBalance so receipt templates use the correct snapshot.
 */

import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";

patch(PosOrder.prototype, {
    setup(vals) {
        super.setup(vals);
        // If the backend stored a snapshot, restore it on the model
        // so receipt templates and getters use the correct historic values.
        // Odoo's PosOrder.setup() assigns vals manually—we must store
        // these ourselves.
        if (!vals) return;
        if (vals.partner_previous_balance !== undefined) {
            this.partner_previous_balance = vals.partner_previous_balance;
            this.partnerBalance = vals.partner_previous_balance;
        }
        if (vals.partner_remaining_balance !== undefined) {
            this.partner_remaining_balance = vals.partner_remaining_balance;
        }
    },
});
