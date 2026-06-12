from odoo import api, models


class ProductProduct(models.Model):
    _inherit = 'product.product'

    @api.model
    def _load_pos_data_fields(self, config):
        fields = super()._load_pos_data_fields(config)
        if 'qty_available' not in fields:
            fields.append('qty_available')
        return fields

    @api.model
    def get_stock_for_pos(self, product_ids):
        products = self.browse(product_ids)
        result = {}
        for p in products:
            result[p.id] = {
                'qty_available': p.qty_available,
                'free_qty': p.free_qty,
            }
        return result
