from odoo import fields, models


class ProductCategory(models.Model):
    _inherit = 'product.category'

    auto_update_cost_from_purchase = fields.Boolean(
        string="Auto-Update Cost from Purchase",
        help="When enabled, the product's cost (standard_price) is automatically updated "
             "to the latest purchase price upon receipt of a purchase order.",
    )
