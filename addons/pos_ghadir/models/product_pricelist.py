"""
Pricelist Rounding Toggle
=========================
Adds an `Always Round Up` checkbox on the pricelist form. When checked,
all price rounding in that pricelist uses ceiling rounding (UP) instead
of the default HALF-UP. The field is synced to the POS frontend so the
behavior applies both server-side and in the POS client.
"""

from odoo import api, fields, models


class ProductPricelist(models.Model):
    _inherit = 'product.pricelist'

    round_up = fields.Boolean(
        string="Always Round Up",
        help="If set, price rounding for this pricelist will always round up (ceiling). "
             "Otherwise standard rounding (HALF-UP) is used.",
    )

    @api.model
    def _load_pos_data_fields(self, config):
        fields = super()._load_pos_data_fields(config)
        fields.append('round_up')
        return fields
