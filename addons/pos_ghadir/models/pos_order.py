"""
POS Order — Balance Snapshots & Performance Instrumentation
===========================================================
Model: pos.order (inherit)

1. Balance Snapshots
   Stores the customer's outstanding balance at order time and the projected
   balance after this order on the pos.order record itself. This ensures old
   receipts re-print with the same values regardless of later accounting changes.

   Fields:
   - partner_previous_balance: Customer's (credit - debit) at order creation,
     captured BEFORE the invoice is created (avoids including current order).
   - partner_remaining_balance: For credit/partial-pay orders = previous_balance
     + order_total (converted to company currency). For fully-paid cash orders
     = previous_balance (balance unchanged).

2. Performance Instrumentation (existing)
   Timing logs on key sync/processing methods with ⏱️ prefix.

Instrumented methods:
- sync_from_ui: Total time to sync orders from the POS frontend
- _process_order: Time to process + writes balance snapshot
- _process_saved_order: Time to process a saved/draft order
  (also disables PDF generation via generate_pdf=False context)
- _generate_pos_order_invoice: Breakdown of invoice creation steps:
  * lock+state, create invoice, post invoice, payment moves,
    reconcile, reversal moves, PDF generation
- read_pos_data: Time to read POS data for an order
"""

import logging
import time

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = 'pos.order'

    partner_previous_balance = fields.Float(
        string='Previous Balance',
        digits='Product Price',
        help="Customer's outstanding balance (credit-debit) at order creation time",
    )
    partner_remaining_balance = fields.Float(
        string='Remaining Balance',
        digits='Product Price',
        help="Projected balance after this order = previous_balance + amount_total",
    )

    @api.model
    def sync_from_ui(self, orders):
        t0 = time.perf_counter()
        result = super().sync_from_ui(orders)
        total = time.perf_counter() - t0
        _logger.info("⏱️ POS sync: TOTAL sync_from_ui = %.3fs", total)
        return result

    @api.model
    def _read_partner_balance(self, partner_id):
        """Return the partner's outstanding balance (credit-debit) in company currency."""
        partner = self.env['res.partner'].sudo().browse(partner_id)
        if not partner.exists():
            return 0.0
        return (partner.credit or 0.0) - (partner.debit or 0.0)

    def _snapshot_balance(self, prev=None):
        """Write balance snapshots on a single fresh order record.
        
        If ``prev`` is provided (pre-process capture), it is used directly
        to avoid the new invoice inflating the partner's balance.
        Otherwise the current partner balance is read.
        
        ``remaining_balance`` reflects the partner's actual total due after
        this order — if fully paid in cash it stays at ``prev`` (no change),
        otherwise it adds the converted order total (credit / partial pay).
        """
        if self.partner_previous_balance or not self.partner_id:
            return
        if prev is None:
            prev = self._read_partner_balance(self.partner_id.id)

        # amount_total may be in POS currency — convert to company currency
        company_currency = self.company_id.currency_id
        pos_currency = self.currency_id or company_currency
        if pos_currency != company_currency:
            total_in_company = pos_currency._convert(
                self.amount_total, company_currency, self.company_id,
                self.date_order or fields.Date.today(),
            )
        else:
            total_in_company = self.amount_total

        # If fully paid in cash the order doesn't change the customer balance
        fully_paid_cash = (
            self.payment_ids
            and all(p.payment_method_id.is_cash_count for p in self.payment_ids)
        )

        self.write({
            'partner_previous_balance': prev,
            'partner_remaining_balance': prev + (0 if fully_paid_cash else total_in_company),
        })

    def _process_order(self, order, existing_order):
        # Capture pre-process balance BEFORE invoices are created
        prev = None
        if not existing_order:
            partner_id = order.get('partner_id') if isinstance(order, dict) else False
            if partner_id:
                prev = self._read_partner_balance(partner_id)

        t0 = time.perf_counter()
        raw = super()._process_order(order, existing_order)
        elapsed = time.perf_counter() - t0
        _logger.info("⏱️ POS order: _process_order = %.3fs", elapsed)
        # raw may be int (order ID) — convert to recordset for snapshot
        record = self.browse(raw) if isinstance(raw, int) else raw
        if prev is not None and record:
            record._snapshot_balance(prev)
        return raw

    def _process_saved_order(self, draft):
        # Capture pre-process balance
        partner_id = draft.get('partner_id') if isinstance(draft, dict) else False
        prev = self._read_partner_balance(partner_id) if partner_id else None

        t0 = time.perf_counter()
        # Disable PDF generation during saved order processing for speed
        raw = super(PosOrder, self.with_context(generate_pdf=False))._process_saved_order(draft)
        elapsed = time.perf_counter() - t0
        _logger.info("⏱️ POS order #%d: _process_saved_order = %.3fs", self.id, elapsed)
        record = self.browse(raw) if isinstance(raw, int) else raw
        if prev is not None and record:
            record._snapshot_balance(prev)
        return raw

    def _generate_pos_order_invoice(self):
        t0 = time.perf_counter()
        invoice = super()._generate_pos_order_invoice()
        total = time.perf_counter() - t0
        _logger.info("⏱️ POS order #%d: _generate_pos_order_invoice TOTAL = %.3fs", self.id, total)
        return invoice

    def read_pos_data(self, data, config):
        t0 = time.perf_counter()
        result = super().read_pos_data(data, config)
        elapsed = time.perf_counter() - t0
        _logger.info("⏱️ POS read_pos_data: %d orders = %.3fs", len(self), elapsed)
        return result
