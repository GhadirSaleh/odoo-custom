/** @odoo-module **/

/**
 * Pricelist Custom Rounding Threshold (POS Frontend)
 * ====================================================
 * Patches: ProductTemplateAccounting.getPrice
 *
 * Problem: Odoo's default pricelist rounding uses HALF-UP (standard
 * rounding). Some businesses need a configurable rounding threshold
 * — e.g., threshold 0.30 means fractional parts above 0.30 round up,
 * below round down (so 130 rounds to 100, 131 to 200).
 *
 * Solution: Override getPrice to read `pricelist.rounding_threshold`
 * and apply a custom rounding function instead of the built-in
 * roundPrecision.
 *
 * The full method body is duplicated from Odoo 19 core because the
 * rounding step sits mid-method after the discount calculation but
 * before surcharge/margin adjustments. Calling super and re-rounding
 * would be incorrect — a value already rounded by one method can't
 * be "unrounded" to apply a different threshold.
 *
 * Server counterpart: product_pricelist_item.py (Python)
 *
 * @see pricelist.rounding_threshold field on product.pricelist
 */

import { ProductTemplateAccounting } from "@point_of_sale/app/models/accounting/product_template_accounting";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

function roundWithThreshold(value, precision, threshold) {
    if (!precision) return value;
    const normalized = value / precision;
    const integer = Math.trunc(normalized);
    if (normalized - integer > threshold) {
        return (integer + 1) * precision;
    }
    return integer * precision;
}

patch(ProductTemplateAccounting.prototype, {
    getPrice(
        pricelist,
        quantity,
        price_extra = 0,
        recurring = false,
        variant = false,
        original_line = false,
        related_lines = []
    ) {
        if (recurring && !pricelist) {
            alert(
                _t(
                    "An error occurred when loading product prices. " +
                        "Make sure all pricelists are available in the POS."
                )
            );
        }

        const product = variant;
        const productTmpl = variant.product_tmpl_id || this;
        const standardPrice = variant ? variant.standard_price : this.standard_price;
        const basePrice = variant ? variant.lst_price : this.list_price;
        let price = basePrice + (price_extra || 0);

        if (!pricelist) {
            return price;
        }

        if (original_line && original_line.isLotTracked() && product) {
            related_lines.push(
                ...original_line.order_id.lines.filter((line) => line.product_id.id == product.id)
            );
            quantity = related_lines.reduce((sum, line) => sum + line.getQuantity(), 0);
        }

        let rule = null;

        if (product) {
            const productRules = pricelist.getRulesByProductId(product.id);
            rule = pricelist.findBestRule(productRules, quantity);
        }

        if (!rule) {
            const tmplRules = pricelist.getRulesByTmplId(productTmpl.id);
            rule = pricelist.findBestRule(tmplRules, quantity);
        }

        if (!rule) {
            const categoryRulesIds = pricelist.getCategoryRulesIds(this.parentCategories);
            if (categoryRulesIds.length > 0) {
                const categoryRules =
                    this.models["product.pricelist.item"].readMany(categoryRulesIds);
                rule = pricelist.findBestRule(categoryRules, quantity);
            }
        }

        if (!rule) {
            const globalRulesIds = pricelist.getGlobalRulesIds();
            if (globalRulesIds.length > 0) {
                const globalRules = this.models["product.pricelist.item"].readMany(globalRulesIds);
                rule = pricelist.findBestRule(globalRules, quantity);
            }
        }

        if (!rule) {
            return price;
        }

        if (rule.base === "pricelist") {
            if (rule.base_pricelist_id) {
                price = this.getPrice(rule.base_pricelist_id, quantity, 0, true, variant);
            }
        } else if (rule.base === "standard_price") {
            price = standardPrice;
        }

        const posCurrency = this.models["pos.config"].getFirst().currency_id;
        const pricelistCurrency = pricelist.currency_id;
        const needsCurrencyConversion =
            pricelistCurrency && posCurrency && pricelistCurrency.id !== posCurrency.id;

        if (needsCurrencyConversion) {
            price *= pricelistCurrency.rate / posCurrency.rate;
        }

        if (rule.compute_price === "fixed") {
            price = rule.fixed_price;
        } else if (rule.compute_price === "percentage") {
            price = price - price * ((rule.percent_price || 0) / 100);
        } else {
            var price_limit = price;
            price -= price * ((rule.price_discount || 0) / 100);
            if (rule.price_round) {
                const threshold = pricelist.rounding_threshold ?? 0.5;
                price = roundWithThreshold(price, rule.price_round, threshold);
            }
            if (rule.price_surcharge) {
                price += rule.price_surcharge;
            }
            if (rule.price_min_margin) {
                price = Math.max(price, price_limit + rule.price_min_margin);
            }
            if (rule.price_max_margin) {
                price = Math.min(price, price_limit + rule.price_max_margin);
            }
        }

        if (needsCurrencyConversion) {
            price *= posCurrency.rate / pricelistCurrency.rate;
        }

        return price;
    },
});
