"""
Res Partner — Customer Account Management Backend
==================================================
Model: res.partner (inherit)

Provides RPC methods called from the POS frontend for customer account
management: listing customers with balances, viewing accounting history,
creating payments, and creating adjustments.

Public RPC methods (called via ORM from JS):
- get_customers_with_balances(query, limit)
  Returns a list of customer dicts with basic info (id, name, phone, mobile).
  Balance is NOT included here — the frontend fetches credit/debit separately
  for performance reasons (bulk read).

- get_partner_info(partner_id)
  Returns basic info for a single customer. Used when loading the statement screen.

- get_account_history(partner_id, limit)
  Returns all posted move lines for the customer's receivable/payable accounts,
  with a running balance. Results are returned in reverse chronological order
  (newest first) for display in the statement screen.

- create_customer_payment(partner_id, amount, notes, config_id, currency_id)
  Creates and posts a journal entry that reduces the customer's receivable
  balance. Debits the POS journal, credits the customer's receivable account.

- create_customer_adjustment(partner_id, type, amount, notes, config_id, currency_id)
  Creates and posts a journal entry for manual balance adjustments.
  Types: 'adjustment_add' (increases balance/debits receivable),
         'adjustment_remove' (decreases balance/credits receivable).

Internal methods:
- _get_or_create_payment_product()
  Finds or creates a "Customer Payment" service product. Currently unused
  but kept for future expansion (e.g., if payments need a product line).

- _create_customer_order(partner_id, amount, notes, config_id, order_type, currency_id)
  Core method that handles payment and adjustment creation. Manages:
  * POS session validation (opens one if not active)
  * Multi-currency conversion using Odoo's currency rate system
  * Journal entry creation with proper debit/credit lines
  * Supports three currencies: transaction, company, and POS

Multi-currency logic:
  The _make_line helper inside _create_customer_order handles three scenarios:
  1. Transaction currency != company currency: convert amounts to both
     company currency (for debit/credit) and POS currency (for amount_currency).
  2. Multi-currency POS but transaction = company currency: use company
     amounts directly, convert to POS currency for amount_currency.
  3. Single currency: no conversion needed, use amounts as-is.
"""

import logging

from odoo import models, fields, api
from odoo.orm.commands import Command

_logger = logging.getLogger(__name__)


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.model
    def get_customers_with_balances(self, query='', limit=100):
        """Search for customers by name. Returns basic info only — no balance.
        The frontend fetches credit/debit separately via orm.read for bulk efficiency."""
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
        """Return basic info for a single customer. Returns False if not found."""
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
        """Return posted move lines for the customer's receivable/payable accounts.
        Includes running balance. Results are reversed (newest first) for UI display."""
        partner = self.env['res.partner'].sudo().browse(partner_id)
        if not partner.exists():
            return []

        # Find all receivable and payable accounts
        receivable_accounts = self.env['account.account'].sudo().search([
            ('account_type', '=', 'asset_receivable'),
        ])
        payable_accounts = self.env['account.account'].sudo().search([
            ('account_type', '=', 'liability_payable'),
        ])
        all_accounts = receivable_accounts | payable_accounts

        # Fetch posted move lines for this partner on those accounts
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
            move_datetime = line.move_id.write_date or line.move_id.create_date
            result.append({
                'id': line.id,
                'date': move_datetime.isoformat() if move_datetime else '',
                'move_name': line.move_id.name or '',
                'ref': line.ref or '',
                'debit': line.debit or 0.0,
                'credit': line.credit or 0.0,
                'balance': running_balance,
                'journal_name': line.journal_id.name or '',
                'amount_currency': line_amount_currency,
                'currency_id': line.currency_id.id if line.currency_id else False,
            })

        # Reverse so newest entries appear first in the UI
        return list(reversed(result))

    @api.model
    def _get_or_create_payment_product(self):
        """Find or create a 'Customer Payment' service product.
        Currently unused but available for future payment product requirements."""
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
    def create_customer_payment(self, partner_id, amount, notes, config_id, currency_id=False):
        """Create a payment that reduces the customer's receivable balance.
        Debits POS journal, credits customer receivable account."""
        return self._create_customer_order(partner_id, amount, notes, config_id, 'payment', currency_id)

    @api.model
    def create_customer_adjustment(self, partner_id, type, amount, notes, config_id, currency_id=False):
        """Create a manual adjustment to the customer's receivable balance.
        type: 'adjustment_add' (increase balance) or 'adjustment_remove' (decrease)."""
        return self._create_customer_order(partner_id, amount, notes, config_id, type, currency_id)

    def _create_customer_order(self, partner_id, amount, notes, config_id, order_type, currency_id=False):
        """Core method for creating journal entries for payments and adjustments.

        Handles:
        - POS session validation (auto-opens if needed)
        - Multi-currency conversion
        - Journal entry creation and posting
        - Returns the move details and new balance

        Args:
            partner_id: Customer to process
            amount: Amount in the transaction currency
            notes: Description for the journal entry reference
            config_id: POS config ID (for journal lookup)
            order_type: 'payment', 'adjustment_add', or 'adjustment_remove'
            currency_id: Optional transaction currency ID (defaults to POS or company currency)

        Returns:
            dict with move_id, move_name, new_balance, amount_paid, amount_company,
            currency_id, company_currency_id — or {'error': message} on failure.
        """
        try:
            partner = self.env['res.partner'].sudo().browse(partner_id)
            if not partner.exists():
                return {'error': 'Partner not found'}

            config = self.env['pos.config'].sudo().browse(config_id)
            if not config.exists():
                return {'error': 'POS configuration not found'}

            # Ensure POS session is open
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

            company_currency = session.company_id.currency_id
            pos_currency = session.currency_id
            today = fields.Date.today()
            is_multi_currency = pos_currency != company_currency

            # Determine transaction currency
            if currency_id:
                transaction_currency = self.env['res.currency'].sudo().browse(currency_id)
                if not transaction_currency.exists():
                    transaction_currency = pos_currency if is_multi_currency else company_currency
            else:
                transaction_currency = pos_currency if is_multi_currency else company_currency

            needs_currency_conversion = transaction_currency != company_currency

            # Convert to company currency for accounting
            if needs_currency_conversion:
                amount_company = transaction_currency._convert(amount, company_currency, session.company_id, today)
            else:
                amount_company = amount

            def _make_line(account_id, partner_id, debit_selected, credit_selected, name):
                """Build a journal entry line dict with proper currency handling.
                Three scenarios: multi-currency conversion, multi-currency POS with
                same transaction currency, or single currency (no conversion)."""
                if needs_currency_conversion:
                    debit_company = transaction_currency._convert(debit_selected, company_currency, session.company_id, today) if debit_selected > 0 else 0.0
                    credit_company = transaction_currency._convert(credit_selected, company_currency, session.company_id, today) if credit_selected > 0 else 0.0
                    amount_cur = transaction_currency._convert(debit_selected - credit_selected, pos_currency, session.company_id, today)
                    line = {
                        'account_id': account_id,
                        'partner_id': partner_id,
                        'debit': debit_company,
                        'credit': credit_company,
                        'name': name,
                        'amount_currency': amount_cur,
                        'currency_id': pos_currency.id,
                    }
                elif is_multi_currency:
                    debit_company = debit_selected if debit_selected > 0 else 0.0
                    credit_company = credit_selected if credit_selected > 0 else 0.0
                    amount_cur = company_currency._convert(debit_selected - credit_selected, pos_currency, session.company_id, today)
                    line = {
                        'account_id': account_id,
                        'partner_id': partner_id,
                        'debit': debit_company,
                        'credit': credit_company,
                        'name': name,
                        'amount_currency': amount_cur,
                        'currency_id': pos_currency.id,
                    }
                else:
                    line = {
                        'account_id': account_id,
                        'partner_id': partner_id,
                        'debit': debit_selected if debit_selected > 0 else 0.0,
                        'credit': credit_selected if credit_selected > 0 else 0.0,
                        'name': name,
                    }
                return Command.create(line)

            # Build journal entry lines based on order type
            if order_type == 'payment':
                # Debit journal, credit receivable (customer pays → balance decreases)
                move_type = 'entry'
                line_vals = [
                    _make_line(journal.default_account_id.id, partner_id, amount, 0, notes or 'Customer Payment'),
                    _make_line(receivable_account.id, partner_id, 0, amount, notes or 'Customer Payment'),
                ]
            elif order_type == 'adjustment_add':
                # Debit receivable, credit journal (increase customer balance)
                move_type = 'entry'
                line_vals = [
                    _make_line(receivable_account.id, partner_id, amount, 0, notes or 'Account Adjustment'),
                    _make_line(journal.default_account_id.id, partner_id, 0, amount, notes or 'Account Adjustment'),
                ]
            elif order_type == 'adjustment_remove':
                # Debit journal, credit receivable (decrease customer balance)
                move_type = 'entry'
                line_vals = [
                    _make_line(journal.default_account_id.id, partner_id, amount, 0, notes or 'Account Adjustment'),
                    _make_line(receivable_account.id, partner_id, 0, amount, notes or 'Account Adjustment'),
                ]
            else:
                return {'error': 'Invalid order type'}

            # Create and post the journal entry
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

            # Fetch the new balance after posting
            partner_record = self.env['res.partner'].sudo().browse(partner_id)
            balance_data = partner_record.read(['credit', 'debit'])
            new_balance = (balance_data[0].get('credit') or 0) - (balance_data[0].get('debit') or 0)
            _logger.info("New balance: credit=%s, debit=%s, balance=%s",
                         balance_data[0].get('credit'), balance_data[0].get('debit'), new_balance)

            return {
                'move_id': move.id,
                'move_name': move.name,
                'new_balance': new_balance,
                'amount_paid': amount,
                'amount_company': amount_company,
                'currency_id': transaction_currency.id,
                'company_currency_id': company_currency.id,
            }
        except Exception as e:
            _logger.exception("Error creating customer order")
            return {'error': str(e)}
