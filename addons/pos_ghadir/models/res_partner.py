from odoo import models, fields, api
from odoo.orm.commands import Command


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.model
    def get_customers_with_balances(self, query='', limit=100):
        domain = []
        if query:
            domain.append(('name', 'ilike', query))
        partners = self.env['res.partner'].sudo().search(domain, limit=limit)
        result = []
        for partner in partners:
            result.append({
                'id': partner.id,
                'name': partner.name,
                'phone': partner.phone or '',
                'mobile': getattr(partner, 'mobile', '') or '',
            })
        return result

    @api.model
    def get_partner_info(self, partner_id):
        partner = self.env['res.partner'].sudo().browse(partner_id)
        if not partner.exists():
            return False
        return {
            'id': partner.id,
            'name': partner.name,
            'phone': partner.phone or '',
            'mobile': getattr(partner, 'mobile', '') or '',
        }

    @api.model
    def get_account_history(self, partner_id, limit=100):
        partner = self.env['res.partner'].sudo().browse(partner_id)
        if not partner.exists():
            return []

        receivable_accounts = self.env['account.account'].sudo().search([
            ('account_type', '=', 'asset_receivable'),
        ])
        payable_accounts = self.env['account.account'].sudo().search([
            ('account_type', '=', 'liability_payable'),
        ])
        all_accounts = receivable_accounts | payable_accounts

        move_lines = self.env['account.move.line'].sudo().search([
            ('partner_id', '=', partner_id),
            ('account_id', 'in', all_accounts.ids),
            ('parent_state', '=', 'posted'),
        ], order='date asc, id asc', limit=limit)

        result = []
        running_balance = 0.0
        for line in move_lines:
            running_balance += line.debit - line.credit
            line_amount_currency = line.amount_currency if line.currency_id else (line.debit - line.credit)
            result.append({
                'id': line.id,
                'date': line.date.isoformat() if line.date else '',
                'move_name': line.move_id.name or '',
                'ref': line.ref or '',
                'debit': line.debit or 0.0,
                'credit': line.credit or 0.0,
                'balance': running_balance,
                'journal_name': line.journal_id.name or '',
                'amount_currency': line_amount_currency,
                'currency_id': line.currency_id.id if line.currency_id else False,
            })

        return result

    @api.model
    def _get_or_create_payment_product(self):
        product = self.env['product.product'].sudo().search([
            ('name', '=', 'Customer Payment'),
            ('type', '=', 'service'),
        ], limit=1)

        if product:
            return product

        default_income_account = self.env['account.account'].sudo().search([
            ('account_type', '=', 'income'),
        ], limit=1)

        vals = {
            'name': 'Customer Payment',
            'type': 'service',
            'sale_ok': False,
            'purchase_ok': False,
            'lst_price': 0.0,
            'taxes_id': [(5, 0, 0)],
            'supplier_taxes_id': [(5, 0, 0)],
        }
        if default_income_account:
            vals['property_account_income_id'] = default_income_account.id

        return self.env['product.product'].sudo().create(vals)

    @api.model
    def create_customer_payment(self, partner_id, amount, notes, config_id):
        return self._create_customer_order(partner_id, amount, notes, config_id, 'payment')

    @api.model
    def create_customer_adjustment(self, partner_id, type, amount, notes, config_id):
        return self._create_customer_order(partner_id, amount, notes, config_id, type)

    def _create_customer_order(self, partner_id, amount, notes, config_id, order_type):
        import logging
        _logger = logging.getLogger(__name__)

        try:
            partner = self.env['res.partner'].sudo().browse(partner_id)
            if not partner.exists():
                return {'error': 'Partner not found'}

            config = self.env['pos.config'].sudo().browse(config_id)
            if not config.exists():
                return {'error': 'POS configuration not found'}

            session = config.current_session_id
            if not session or session.state != 'opened':
                config.sudo().open_ui()
                session = config.current_session_id
                if not session or session.state != 'opened':
                    return {'error': 'Could not open POS session'}

            journal = session.config_id.journal_id
            if not journal:
                return {'error': 'No journal configured for this POS'}

            receivable_account = partner.property_account_receivable_id
            if not receivable_account:
                return {'error': 'Customer has no receivable account configured'}

            is_in_company_currency = session.is_in_company_currency
            pos_currency = session.currency_id
            company_currency = session.company_id.currency_id
            today = fields.Date.today()

            if is_in_company_currency:
                amount_company = amount
                amount_pos = amount
                currency_id = False
            else:
                amount_company = pos_currency._convert(amount, company_currency, session.company_id, today)
                amount_pos = amount
                currency_id = pos_currency.id

            def _make_line(account_id, partner_id, debit_pos, credit_pos, name):
                debit_company = debit_pos if is_in_company_currency else pos_currency._convert(debit_pos, company_currency, session.company_id, today)
                credit_company = credit_pos if is_in_company_currency else pos_currency._convert(credit_pos, company_currency, session.company_id, today)
                line = {
                    'account_id': account_id,
                    'partner_id': partner_id,
                    'debit': debit_company if debit_company > 0 else 0.0,
                    'credit': credit_company if credit_company > 0 else 0.0,
                    'name': name,
                }
                if not is_in_company_currency:
                    amount_cur = debit_pos - credit_pos
                    line['amount_currency'] = amount_cur
                    line['currency_id'] = pos_currency.id
                return Command.create(line)

            if order_type == 'payment':
                move_type = 'entry'
                line_vals = [
                    _make_line(journal.default_account_id.id, partner_id, amount, 0, notes or 'Customer Payment'),
                    _make_line(receivable_account.id, partner_id, 0, amount, notes or 'Customer Payment'),
                ]
            elif order_type == 'adjustment_add':
                move_type = 'entry'
                line_vals = [
                    _make_line(receivable_account.id, partner_id, amount, 0, notes or 'Account Adjustment'),
                    _make_line(journal.default_account_id.id, partner_id, 0, amount, notes or 'Account Adjustment'),
                ]
            elif order_type == 'adjustment_remove':
                move_type = 'entry'
                line_vals = [
                    _make_line(journal.default_account_id.id, partner_id, amount, 0, notes or 'Account Adjustment'),
                    _make_line(receivable_account.id, partner_id, 0, amount, notes or 'Account Adjustment'),
                ]
            else:
                return {'error': 'Invalid order type'}

            move = self.env['account.move'].sudo().create({
                'move_type': move_type,
                'journal_id': journal.id,
                'partner_id': partner_id,
                'date': today,
                'ref': notes or 'Customer Account Transaction',
                'line_ids': line_vals,
            })
            move.action_post()

            _logger.info("Account move created: %s (id=%s)", move.name, move.id)

            partner_record = self.env['res.partner'].sudo().browse(partner_id)
            balance_data = partner_record.read(['credit', 'debit'])
            new_balance = (balance_data[0].get('credit') or 0) - (balance_data[0].get('debit') or 0)
            _logger.info("New balance: credit=%s, debit=%s, balance=%s",
                         balance_data[0].get('credit'), balance_data[0].get('debit'), new_balance)

            return {
                'move_id': move.id,
                'move_name': move.name,
                'new_balance': new_balance,
                'amount_pos': amount_pos,
                'amount_company': amount_company,
                'currency_id': pos_currency.id,
                'company_currency_id': company_currency.id,
            }
        except Exception as e:
            _logger.exception("Error creating customer order")
            return {'error': str(e)}
