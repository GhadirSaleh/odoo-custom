"""
Quick Exchange Rate Setter
==========================
RPC method called from the POS frontend to set today's exchange rate.

Permission note: res.currency.rate write access requires the Account
Manager group (group_account_manager). This method uses sudo() because
POS cashiers typically don't have that group but need to update rates
directly from the register.
"""

from odoo import api, fields, models


class ResCurrency(models.Model):
    _inherit = 'res.currency'

    @api.model
    def set_currency_rate_from_pos(self, currency_id, rate_value):
        """Set today's exchange rate from the POS.

        rate_value = units of `currency_id` per 1 USD
        (e.g., 13000 SYP per 1 USD).
        Creates or updates the res.currency.rate record for today.
        """
        company = self.env.company
        today = fields.Date.today()

        Rate = self.env['res.currency.rate'].sudo()
        rate_record = Rate.search([
            ('currency_id', '=', currency_id),
            ('name', '=', today),
            ('company_id', 'in', [False, company.root_id.id]),
        ], limit=1)

        if rate_record:
            rate_record.write({'rate': rate_value})
        else:
            Rate.create({
                'currency_id': currency_id,
                'name': today,
                'rate': rate_value,
                'company_id': company.root_id.id,
            })

        return {'success': True}
