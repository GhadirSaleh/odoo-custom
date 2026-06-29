"""
Product Product — POS Stock Data
=================================
Model: product.product (inherit)

Ensures qty_available is included in the POS session's product field list,
and provides an RPC method for the POS frontend to fetch real-time stock
quantities for a set of products.

RPC methods:
- get_stock_for_pos(product_ids) → {product_id: {qty_available, free_qty}, ...}
  Called by stock_alerts.js on POS startup and after order validation.
"""

from odoo import api, models


class ProductProduct(models.Model):
    _inherit = 'product.product'

    @api.model
    def _load_pos_data_fields(self, config):
        """Include qty_available in the POS data payload so stock badges work."""
        fields = super()._load_pos_data_fields(config)
        if 'qty_available' not in fields:
            fields.append('qty_available')
        return fields

    @api.model
    def get_stock_for_pos(self, product_ids):
        """Fetch real-time stock quantities for POS stock alert badges.
        
        Args:
            product_ids: List of product IDs to query.
        
        Returns:
            dict mapping each product ID to {qty_available, free_qty}.
        """
        products = self.browse(product_ids)
        result = {}
        for p in products:
            result[p.id] = {
                'qty_available': p.qty_available,
                'free_qty': p.free_qty,
            }
        return result
