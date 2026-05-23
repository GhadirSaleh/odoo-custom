/** @odoo-module **/

/**
 * Dual Currency Display
 * =====================
 * Patches: PosOrder, PosStore, OrderDisplay
 *
 * Problem: When the POS operates in a currency different from the company's
 * base currency, cashiers and customers cannot see the equivalent amount
 * in the company currency.
 *
 * Solution:
 * 1. Add `convertedTotal` getter on PosOrder — converts the order's totalDue
 *    from POS currency to company currency using the stored exchange rate.
 * 2. Add `formattedConvertedTotal` getter — formats the converted amount
 *    with the company currency symbol, stripping the symbol from the raw
 *    formatCurrency output to avoid double symbols.
 * 3. Patch OrderDisplay to expose `convertedTotalDisplay` for use in the
 *    order screen template.
 *
 * Display locations (see dual_currency_display.xml):
 * - Order screen: shown before the total and subtotal spans
 * - Receipt: shown after the receipt-total div as "Total(USD) 1,234.56 $"
 *
 * The display is hidden when:
 * - POS currency === company currency
 * - Exchange rate is 1 (no meaningful conversion)
 * - Converted total is null/empty
 *
 * Currency rates are stored in models._currencyRates (set by
 * partner_due_currency_convert.js on PosStore setup).
 */

import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { OrderDisplay } from "@point_of_sale/app/components/order_display/order_display";
import { formatCurrency } from "@web/core/currency";

patch(PosOrder.prototype, {
    get convertedTotal() {
        const posCurrency = this.currency;
        const companyCurrency = this.company?.currency_id;

        // No conversion needed if same currency
        if (!companyCurrency || posCurrency.id === companyCurrency.id) {
            return null;
        }

        const rate = this.models._currencyRates?.[posCurrency.id];
        if (!rate || rate === 1) {
            return null;
        }

        const total = this.totalDue ?? 0;
        const converted = total * rate;
        return Math.round(converted * 100) / 100;
    },

    get formattedConvertedTotal() {
        const converted = this.convertedTotal;
        if (converted === null) {
            return "";
        }
        const companyCurrency = this.company?.currency_id;
        if (!companyCurrency) {
            return "";
        }
        const symbol = companyCurrency.symbol || "";
        // formatCurrency includes the symbol; strip it to avoid duplication
        // since we append the symbol manually
        const formatted = formatCurrency(converted, companyCurrency.id, {
            trailingZeros: false,
        });
        const numberPart = formatted.replace(new RegExp(`\\s*${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, "g"), "").trim();
        return `${numberPart} ${symbol}`;
    },
});

patch(PosStore.prototype, {
    async setup() {
        await super.setup(...arguments);
        // Ensure the rates container exists (populated by partner_due_currency_convert.js)
        if (!this.models._currencyRates) {
            this.models._currencyRates = {};
        }
    },
});

patch(OrderDisplay.prototype, {
    get convertedTotalDisplay() {
        const order = this.props.order;
        if (!order) return "";
        return order.formattedConvertedTotal || "";
    },
});
