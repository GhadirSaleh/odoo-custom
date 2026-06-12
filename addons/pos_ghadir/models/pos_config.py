from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    pos_show_stock_alerts = fields.Boolean(
        string="Show Stock Alerts in POS",
        default=True,
    )
    pos_low_stock_threshold = fields.Float(
        string="Low Stock Threshold",
        default=5.0,
    )
