"""
Product Template — POS Field Sync
==================================
Model: product.template (inherit)

Ensures qty_available is included in the POS data payload at the template
level. Used alongside product_product to make stock quantities available
for stock alert badges in the POS.
"""

from odoo import api, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    @api.model
    def _load_pos_data_fields(self, config_id):
        """Include qty_available in the template-level POS data fields."""
        fields = super()._load_pos_data_fields(config_id)
        fields += ['qty_available']
        return fields
