"""
Pricelist Item Price Computation — Custom Rounding Threshold
=============================================================
Overrides `_compute_price` and `_compute_rule_tip` on
`product.pricelist.item` to use a configurable rounding threshold
instead of hardcoded HALF-UP or UP.

The methods are fully duplicated from Odoo 19 core because the rounding
step sits in the middle of the method, and downstream calculations
(surcharge, min/max margins) depend on the rounded value. Simply calling
super and re-rounding would give incorrect results (a value rounded down
by HALF-UP cannot be "unrounded" to apply a different method correctly).
"""

import math

from odoo import _, api, models
from odoo.tools import format_amount


def _round_with_threshold(value, precision, threshold):
    """Round `value` to `precision` using a configurable threshold.

    If the fractional part of (value / precision) exceeds `threshold`,
    the value rounds up; otherwise it rounds down.

    Examples with precision=100, threshold=0.30:
      129 → 100  (frac=0.29, not > 0.30)
      130 → 100  (frac=0.30, not > 0.30)
      131 → 200  (frac=0.31,     > 0.30)
    """
    if not precision:
        return value
    normalized = value / precision
    integer = math.trunc(normalized)
    if normalized - integer > threshold:
        return (integer + 1) * precision
    return integer * precision


class ProductPricelistItem(models.Model):
    _inherit = 'product.pricelist.item'

    def _compute_price(self, product, quantity, uom, date, currency=None, **kwargs):
        self and self.ensure_one()
        product.ensure_one()
        uom.ensure_one()

        currency = currency or self.currency_id or self.env.company.currency_id
        currency.ensure_one()

        product_uom = product.uom_id
        if product_uom != uom:
            convert = lambda p: product_uom._compute_price(p, uom)
        else:
            convert = lambda p: p

        if self.compute_price == 'fixed':
            price = convert(self.fixed_price)
        elif self.compute_price == 'percentage':
            base_price = self._compute_base_price(product, quantity, uom, date, currency, **kwargs)
            price = (base_price - (base_price * (self.percent_price / 100))) or 0.0
        elif self.compute_price == 'formula':
            base_price = self._compute_base_price(product, quantity, uom, date, currency, **kwargs)
            price_limit = base_price
            discount = self.price_discount if self.base != 'standard_price' else -self.price_markup
            price = base_price - (base_price * (discount / 100))
            if self.price_round:
                threshold = self.pricelist_id.rounding_threshold
                price = _round_with_threshold(price, self.price_round, threshold)
            if self.price_surcharge:
                price += convert(self.price_surcharge)
            if self.price_min_margin:
                price = max(price, price_limit + convert(self.price_min_margin))
            if self.price_max_margin:
                price = min(price, price_limit + convert(self.price_max_margin))
        else:
            price = self._compute_base_price(product, quantity, uom, date, currency, **kwargs)

        return price

    @api.depends_context('lang')
    @api.depends(
        'base', 'compute_price', 'price_discount', 'price_markup', 'price_round', 'price_surcharge',
    )
    def _compute_rule_tip(self):
        base_selection_vals = dict(self._fields['base']._description_selection(self.env))
        self.rule_tip = False
        for item in self:
            if item.compute_price != 'formula' or not item.base:
                continue
            base_amount = 100
            discount = item.price_discount if item.base != 'standard_price' else -item.price_markup
            discount_factor = (100 - discount) / 100
            discounted_price = base_amount * discount_factor
            if item.price_round:
                threshold = item.pricelist_id.rounding_threshold
                discounted_price = _round_with_threshold(discounted_price, item.price_round, threshold)
            surcharge = format_amount(item.env, item.price_surcharge, item.currency_id)
            discount_type, discount = self._get_displayed_discount(item)

            item.rule_tip = _(
                "%(base)s with a %(discount)s %% %(discount_type)s and %(surcharge)s extra fee\n"
                "Example: %(amount)s * %(discount_charge)s + %(price_surcharge)s → %(total_amount)s",
                base=base_selection_vals[item.base],
                discount=discount,
                discount_type=discount_type,
                surcharge=surcharge,
                amount=format_amount(item.env, 100, item.currency_id),
                discount_charge=discount_factor,
                price_surcharge=surcharge,
                total_amount=format_amount(
                    item.env, discounted_price + item.price_surcharge, item.currency_id),
            )
