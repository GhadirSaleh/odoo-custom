/** @odoo-module **/

/**
 * Partner Due Currency Conversion
 * ================================
 * Patches: PosOrder, PosStore
 *
 * Problem: In a multi-currency setup, the partner's outstanding balance
 * (partnerBalance) is in the company currency, but the order total is in
 * the POS currency. When showing "remaining balance" on the receipt,
 * both amounts need to be in the same currency.
 *
 * Solution:
 * 1. Add a computed getter `convertedPartnerDue` on PosOrder that combines
 *    the partner's balance with the order's total due, converting both to
 *    the company currency using live exchange rates.
 * 2. Fetch currency rates from the server on PosStore setup and store them
 *    in models._currencyRates for use by all currency-related patches.
 *
 * Conversion logic:
 * - Uses `totalDue` because باقي الحساب must reflect the customer's final
 *   balance after this transaction (previous balance + full order amount),
 *   regardless of payment method or amount paid.
 * - If POS currency === company currency: no conversion needed
 * - If different: multiply POS amounts by the exchange rate
 * - Rates are fetched once on setup, and refreshed when calculatePartnerDue
 *   is called (e.g., after currency changes)
 *
 * Prefers the stored backend field `partner_remaining_balance` when available
 * (re-printed receipts) so the value is always the exact snapshot from order time.
 *
 * Used by: receipt_partner_balance.xml (باقي الحساب display)
 */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { getCurrencyRates } from "@web/core/currency";
import { formatAmountAfterSymbol } from "./currency_utils";

patch(PosOrder.prototype, {
    get convertedPartnerDue() {
        // Prefer the backend snapshot — exact value from order creation time
        if (this.partner_remaining_balance !== undefined) {
            return this.partner_remaining_balance;
        }

        const partnerDue = this.partnerBalance ?? 0;

        // Use totalDue because باقي الحساب must reflect the customer's
        // final balance after this transaction: previous balance + full
        // order amount — regardless of payment method or amount paid.
        const orderTotal = this.totalDue ?? 0;

        const posCurrency = this.currency;
        const companyCurrency = this.company?.currency_id;

        // No conversion needed if same currency
        if (!companyCurrency || posCurrency.id === companyCurrency.id) {
            return Math.round((partnerDue + orderTotal) * 100) / 100;
        }

        const rate = this.models._currencyRates?.[posCurrency.id];
        if (!rate) {
            return Math.round((partnerDue + orderTotal) * 100) / 100;
        }

        const convertedOrderTotal = orderTotal * rate;
        return Math.round((partnerDue + convertedOrderTotal) * 100) / 100;
    },

    get formattedConvertedPartnerDue() {
        if (this.convertedPartnerDue === undefined || this.convertedPartnerDue === null) return "";
        return formatAmountAfterSymbol(this.convertedPartnerDue, this.company?.currency_id);
    },
});

patch(PosStore.prototype, {
    async setup() {
        await super.setup(...arguments);
        // Fetch exchange rates once on POS startup
        this.models._currencyRates = {};
        try {
            this.models._currencyRates = await getCurrencyRates();
        } catch (e) {
            console.error("Error fetching currency rates:", e);
        }
    },

    async calculatePartnerDue() {
        const order = this.getOrder();
        if (!order) return;

        // Refresh rates if they're empty (e.g., after a long idle period)
        if (
            !this.models._currencyRates ||
            Object.keys(this.models._currencyRates).length === 0
        ) {
            try {
                this.models._currencyRates = await getCurrencyRates();
            } catch (e) {
                console.error("Error fetching currency rates:", e);
            }
        }

        // Trigger recompute of all prices that depend on the conversion
        order.triggerRecomputeAllPrices();
    },
});
