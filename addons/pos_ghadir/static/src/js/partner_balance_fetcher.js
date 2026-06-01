/** @odoo-module **/

/**
 * Partner Balance Fetcher
 * =======================
 * Patches: PosStore, SelectPartnerButton
 *
 * Problem: When a customer is selected in POS, their outstanding balance
 * (credit - debit from accounting) is not displayed anywhere in the UI.
 *
 * Solution:
 * 1. Patch PosStore to fetch the partner's balance from the server whenever
 *    a customer is assigned to the current order. The balance is stored in
 *    a reactive object (_partnerBalance) so the UI updates automatically.
 * 2. Patch SelectPartnerButton's template to display the balance next to
 *    the customer name when it's non-zero. Color-coded: red for positive
 *    balance (customer owes), green for negative (credit), muted for zero.
 *
 * Data flow:
 * - setPartnerToCurrentOrder(partner) → _fetchPartnerBalance(partner, order)
 * - Server call: orm.read("res.partner", [id], ["credit", "debit"])
 * - Result stored in pos._partnerBalance.balance AND order.partnerBalance
 *   (order.partnerBalance is used by receipt templates)
 *
 * Gotchas:
 * - Uses reactive() instead of useState() because PosStore is a service,
 *   not an Owl component. Hooks are not allowed in services.
 * - The balance is fetched on POS setup if an order already has a partner.
 */

import { patch } from "@web/core/utils/patch";
import { reactive } from "@odoo/owl";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { SelectPartnerButton } from "@point_of_sale/app/screens/product_screen/control_buttons/select_partner_button/select_partner_button";
import { xml } from "@odoo/owl";
import { formatCurrency } from "@web/core/currency";

// ---------------------------------------------------------------------------
// 1. Patch PosStore — use reactive() instead of useState() (it's a service,
//    not a component, so hooks are not allowed here)
// ---------------------------------------------------------------------------
patch(PosStore.prototype, {
    async setup() {
        await super.setup(...arguments);
        // If the current order already has a partner, fetch their balance
        const order = this.getOrder();
        if (order?.partner_id) {
            await this._fetchPartnerBalance(order.partner_id, order);
        }
    },

    get currentPartnerBalance() {
        return this._partnerBalance?.balance ?? 0;
    },

    async setPartnerToCurrentOrder(partner) {
        await super.setPartnerToCurrentOrder(partner);

        // Reset balance before fetching new one
        if (!this._partnerBalance) {
            this._partnerBalance = reactive({ balance: 0 });
        }
        this._partnerBalance.balance = 0;

        const order = this.getOrder();
        if (order) {
            order.partnerBalance = 0;
        }

        if (!partner) return;

        await this._fetchPartnerBalance(partner, order);
    },

    async _fetchPartnerBalance(partner, order) {
        if (!this._partnerBalance) {
            this._partnerBalance = reactive({ balance: 0 });
        }

        try {
            const orm = this.env?.services?.orm;
            if (!orm) return;

            const result = await orm.read(
                "res.partner",
                [partner.id],
                ["credit", "debit"],
            );

            if (result?.length) {
                const { credit = 0, debit = 0 } = result[0];
                const balance = credit - debit;
                this._partnerBalance.balance = balance;

                // Also store on the order so receipt templates can access it.
                // But only if there's no stored snapshot — a backend snapshot
                // (partner_previous_balance) represents the exact balance at
                // order creation time and must not be overwritten by live data.
                if (order && order.partner_previous_balance === undefined) {
                    order.partnerBalance = balance;
                }
            }
        } catch (error) {
            console.error("Error fetching partner balance:", error);
        }
    },

    get partnerBalanceClass() {
        const bal = this._partnerBalance?.balance ?? 0;
        if (bal > 0) return "text-danger";
        if (bal < 0) return "text-success";
        return "text-muted";
    },
});

// ---------------------------------------------------------------------------
// 2. PosOrder — formatted balance getter for receipt templates
// ---------------------------------------------------------------------------
patch(PosOrder.prototype, {
    get formattedPartnerBalance() {
        if (this.partnerBalance === undefined || this.partnerBalance === null) return "";
        const companyCurrency = this.company?.currency_id;
        if (!companyCurrency) {
            return formatCurrency(this.partnerBalance, null, { trailingZeros: false });
        }
        const symbol = companyCurrency.symbol || "";
        const formatted = formatCurrency(this.partnerBalance, companyCurrency.id, { trailingZeros: false });
        const numberPart = formatted.replace(new RegExp(`\\s*${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, "g"), "").trim();
        return `${numberPart} ${symbol}`;
    },
});

// ---------------------------------------------------------------------------
// 3. PosStore — formatted balance getter for SelectPartnerButton template
// ---------------------------------------------------------------------------
patch(PosStore.prototype, {
    get formattedCurrentPartnerBalance() {
        const balance = this.currentPartnerBalance;
        const companyCurrency = this.company?.currency_id;
        if (!companyCurrency) {
            return formatCurrency(balance, null, { trailingZeros: false });
        }
        const symbol = companyCurrency.symbol || "";
        const formatted = formatCurrency(balance, companyCurrency.id, { trailingZeros: false });
        const numberPart = formatted.replace(new RegExp(`\\s*${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, "g"), "").trim();
        return `${numberPart} ${symbol}`;
    },
});

// ---------------------------------------------------------------------------
// 4. SelectPartnerButton — override template to show balance next to name
// ---------------------------------------------------------------------------
patch(SelectPartnerButton, {
    template: xml`
        <button
            class="set-partner btn btn-secondary btn-lg lh-lg text-truncate w-auto"
            t-on-click="() => this.pos.selectPartner()"
        >
            <t t-if="props.partner">
                <span class="text-truncate text-action" t-esc="props.partner.name"/>
                <t t-if="pos.currentPartnerBalance !== 0">
                    <span t-att-class="'ms-1 ' + pos.partnerBalanceClass" dir="ltr">
                        <t t-esc="pos.formattedCurrentPartnerBalance"/>
                    </span>
                </t>
            </t>
            <t t-else="">Customer</t>
        </button>
    `,
});
