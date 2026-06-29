"""
Pricelist Rounding Threshold
=============================
Adds a `Rounding Threshold` percentage field on the pricelist form.
Controls where the rounding cutoff sits between DOWN and UP:
- 0.00 = always round down (floor)
- 0.50 = closest to standard HALF-UP
- 1.00 = always round up (ceiling)
- Custom value = fractional part must exceed this threshold to round up

The field is synced to the POS frontend so the behavior applies both
server-side and in the POS client.
"""

from odoo import api, fields, models


class ProductPricelist(models.Model):
    _inherit = 'product.pricelist'

    rounding_threshold = fields.Float(
        string="Rounding Threshold",
        default=0.50,
        help="Fractional threshold for rounding. "
             "If the fractional part exceeds this value, the price rounds up; "
             "otherwise it rounds down.\n"
             "0.00 = always round down (floor)\n"
             "0.50 = closest to standard HALF-UP\n"
             "1.00 = always round up (ceiling)",
    )

    @api.model
    def _load_pos_data_fields(self, config):
        fields = super()._load_pos_data_fields(config)
        fields.append('rounding_threshold')
        return fields
