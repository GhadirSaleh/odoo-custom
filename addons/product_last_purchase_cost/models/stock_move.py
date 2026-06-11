from odoo import models


class StockMove(models.Model):
    _inherit = 'stock.move'

    def _action_done(self, cancel_backorder=False):
        moves_todo = super()._action_done(cancel_backorder)

        for move in moves_todo:
            if not move.purchase_line_id:
                continue
            if not move.product_id.categ_id.auto_update_cost_from_purchase:
                continue
            if not move.price_unit or move.quantity <= 0:
                continue

            move.product_id.with_company(move.company_id).sudo().standard_price = move.price_unit

        return moves_todo
