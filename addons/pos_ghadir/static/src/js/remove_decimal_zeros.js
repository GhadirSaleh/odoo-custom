/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosOrderAccounting } from "@point_of_sale/app/models/accounting/pos_order_accounting";
import { PosOrderlineAccounting } from "@point_of_sale/app/models/accounting/pos_order_line_accounting";
import { formatCurrency } from "@web/core/currency";
import { _t } from "@web/core/l10n/translation";

// Helper function to format currency without trailing zeros (.00)
function formatCurrencyNoTrailingZeros(amount, currencyId) {
    return formatCurrency(amount, currencyId, { trailingZeros: false });
}

// Patch order-level price formatters
patch(PosOrderAccounting.prototype, {
    get currencyDisplayPrice() {
        return formatCurrencyNoTrailingZeros(this.displayPrice, this.currency.id);
    },
    get currencyDisplayPriceIncl() {
        return formatCurrencyNoTrailingZeros(this.priceIncl, this.currency.id);
    },
    get currencyDisplayPriceExcl() {
        return formatCurrencyNoTrailingZeros(this.priceExcl, this.currency.id);
    },
    get currencyAmountTaxes() {
        return formatCurrencyNoTrailingZeros(this.amountTaxes, this.currency.id);
    },
});

// Patch line-level price formatters
patch(PosOrderlineAccounting.prototype, {
    get currencyDisplayPrice() {
        if (this.combo_parent_id) {
            return "";
        }
        if (this.getDiscount() === 100) {
            return _t("Free");
        }
        return formatCurrencyNoTrailingZeros(this.displayPrice, this.currency.id);
    },
    get currencyDisplayPriceUnit() {
        return formatCurrencyNoTrailingZeros(this.displayPriceUnit, this.currency.id);
    },
    get currencyDisplayPriceUnitExcl() {
        return formatCurrencyNoTrailingZeros(this.displayPriceUnitExcl, this.currency.id);
    },
});
