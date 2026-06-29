"""
POS Config — Stock Alert Settings
==================================
Model: pos.config (inherit)

Adds two configuration fields to the POS settings form that control
the stock alert badge behavior in the POS interface.

Fields:
- pos_show_stock_alerts: Master toggle to enable/disable stock badges.
- pos_low_stock_threshold: Quantity threshold for "low stock" state.
  Products with qty_available < threshold are shown as amber ("low");
  products with qty_available <= 0 are shown as red ("out").
"""

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
