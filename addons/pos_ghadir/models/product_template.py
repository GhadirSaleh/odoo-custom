from odoo import api, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    @api.model
    def _load_pos_data_fields(self, config_id):
        fields = super()._load_pos_data_fields(config_id)
        fields += ['qty_available']
        return fields
