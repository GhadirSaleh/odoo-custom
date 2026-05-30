"""
POS Order Performance Instrumentation
=====================================
Model: pos.order (inherit)

Adds timing instrumentation to key POS order processing methods.
Each method logs its execution time to help identify performance bottlenecks
during order sync, processing, and invoice generation.

Instrumented methods:
- sync_from_ui: Total time to sync orders from the POS frontend
- _process_order: Time to process a single order
- _process_saved_order: Time to process a saved/draft order
  (also disables PDF generation via generate_pdf=False context)
- _generate_pos_order_invoice: Breakdown of invoice creation steps:
  * lock+state: Acquiring record lock and setting state to 'done'
  * create invoice: Building the invoice record
  * post invoice: Posting the invoice (account.move._post)
  * payment moves: Creating payment journal entries
  * reconcile: Reconciling invoice payments
  * reversal moves: Creating reversal entries for closed sessions
  * PDF generation: Only if generate_pdf context is True
- read_pos_data: Time to read POS data for an order

Note: All logging uses the ⏱️ emoji prefix for easy grepping.
To disable, remove this module or comment out the _logger calls.
"""

import logging
import time

from odoo import api, models
from odoo.exceptions import UserError
from odoo.tools import _

_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def sync_from_ui(self, orders):
        t0 = time.perf_counter()
        result = super().sync_from_ui(orders)
        total = time.perf_counter() - t0
        _logger.info("⏱️ POS sync: TOTAL sync_from_ui = %.3fs", total)
        return result

    def _process_order(self, order, existing_order):
        t0 = time.perf_counter()
        result = super()._process_order(order, existing_order)
        elapsed = time.perf_counter() - t0
        _logger.info("⏱️ POS order: _process_order = %.3fs", elapsed)
        return result

    def _process_saved_order(self, draft):
        t0 = time.perf_counter()
        # Disable PDF generation during saved order processing for speed
        result = super(PosOrder, self.with_context(generate_pdf=False))._process_saved_order(draft)
        elapsed = time.perf_counter() - t0
        _logger.info("⏱️ POS order #%d: _process_saved_order = %.3fs", self.id, elapsed)
        return result

    def _generate_pos_order_invoice(self):
        t0 = time.perf_counter()

        # Step 1: Lock records and set order state to 'done'
        t1 = time.perf_counter()
        if not self.env['res.company']._with_locked_records(self, allow_raising=False):
            raise UserError(_("Some orders are already being invoiced. Please try again later."))
        self.state = 'done'
        _logger.info("⏱️ POS order #%d:   lock+state = %.3fs", self.id, time.perf_counter() - t1)

        # Step 2: Create the invoice record
        t1 = time.perf_counter()
        company = self.company_id
        invoice_vals = self._prepare_invoice_vals()
        invoice = self._create_invoice(invoice_vals)
        _logger.info("⏱️ POS order #%d:   create invoice = %.3fs", self.id, time.perf_counter() - t1)

        # Step 3: Post the invoice (makes it official in accounting)
        t1 = time.perf_counter()
        invoice.sudo().with_company(company).with_context(**self._get_invoice_post_context())._post()
        _logger.info("⏱️ POS order #%d:   post invoice = %.3fs", self.id, time.perf_counter() - t1)

        # Step 4: Create payment journal entries
        t1 = time.perf_counter()
        payment_moves_from_closed_sessions = {}
        all_payment_moves = self.env['account.move']
        for session, orders in self.grouped('session_id').items():
            is_session_closed = session.state == 'closed'
            for order in orders:
                order_payments = order._get_payments()
                payment_moves = order_payments._create_payment_moves(is_session_closed)
                all_payment_moves |= payment_moves
                if is_session_closed:
                    payment_moves_from_closed_sessions[order] = payment_moves
        _logger.info("⏱️ POS order #%d:   payment moves = %.3fs", self.id, time.perf_counter() - t1)

        # Step 5: Reconcile invoice with payments
        t1 = time.perf_counter()
        self._reconcile_invoice_payments(invoice, all_payment_moves)
        _logger.info("⏱️ POS order #%d:   reconcile = %.3fs", self.id, time.perf_counter() - t1)

        # Step 6: Create reversal entries for closed sessions
        t1 = time.perf_counter()
        for order, payment_moves in payment_moves_from_closed_sessions.items():
            order._create_misc_reversal_move(payment_moves)
        _logger.info("⏱️ POS order #%d:   reversal moves = %.3fs", self.id, time.perf_counter() - t1)

        # Step 7: Generate and send PDF (only if not disabled via context)
        if self.env.context.get('generate_pdf', True):
            t1 = time.perf_counter()
            invoice.with_context(skip_invoice_sync=True)._generate_and_send()
            _logger.info("⏱️ POS order #%d:   PDF generation = %.3fs", self.id, time.perf_counter() - t1)

        total = time.perf_counter() - t0
        _logger.info("⏱️ POS order #%d: _generate_pos_order_invoice TOTAL = %.3fs", self.id, total)
        return invoice

    def read_pos_data(self, data, config):
        t0 = time.perf_counter()
        result = super().read_pos_data(data, config)
        elapsed = time.perf_counter() - t0
        _logger.info("⏱️ POS read_pos_data: %d orders = %.3fs", len(self), elapsed)
        return result
