/** @odoo-module **/

/**
 * Clean Currency Format — Remove Trailing Zeros
 * ==============================================
 * Patches: PosOrderAccounting, PosOrderlineAccounting
 *
 * Problem: Odoo's default currency formatting always shows trailing zeros
 * (e.g., "$10.00"). For this POS, cleaner display without trailing zeros
 * is preferred (e.g., "$10").
 *
 * Solution: Patch the currencyDisplayPrice getters on both the order-level
 * and line-level accounting mixins to use formatCurrency with
 * trailingZeros: false.
 *
 * Patched getters:
 * - PosOrderAccounting: currencyDisplayPrice, currencyDisplayPriceIncl,
 *   currencyDisplayPriceExcl, currencyAmountTaxes
 * - PosOrderlineAccounting: currencyDisplayPrice, currencyDisplayPriceUnit,
 *   currencyDisplayPriceUnitExcl
 *
 * Special case: When a line has 100% discount, display "Free" instead of "0".
 */

import { patch } from "@web/core/utils/patch";
import { PosOrderAccounting } from "@point_of_sale/app/models/accounting/pos_order_accounting";
import { PosOrderlineAccounting } from "@point_of_sale/app/models/accounting/pos_order_line_accounting";
import { PosPayment } from "@point_of_sale/app/models/pos_payment";
import { _t } from "@web/core/l10n/translation";
import { formatAmountAfterSymbol } from "./currency_utils";

// Patch order-level price formatters
patch(PosOrderAccounting.prototype, {
    get currencyDisplayPrice() {
        return formatAmountAfterSymbol(this.displayPrice, this.currency.id);
    },
    get currencyDisplayPriceIncl() {
        return formatAmountAfterSymbol(this.priceIncl, this.currency.id);
    },
    get currencyDisplayPriceExcl() {
        return formatAmountAfterSymbol(this.priceExcl, this.currency.id);
    },
    get currencyAmountTaxes() {
        return formatAmountAfterSymbol(this.amountTaxes, this.currency.id);
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
        return formatAmountAfterSymbol(this.displayPrice, this.currency.id);
    },
    get currencyDisplayPriceUnit() {
        return formatAmountAfterSymbol(this.displayPriceUnit, this.currency.id);
    },
    get currencyDisplayPriceUnitExcl() {
        return formatAmountAfterSymbol(this.displayPriceUnitExcl, this.currency.id);
    },
});

// Patch payment lines to format amounts without trailing zeros
patch(PosPayment.prototype, {
    get formattedAmount() {
        return formatAmountAfterSymbol(this.getAmount(), this.pos_order_id.currency.id);
    },
});
