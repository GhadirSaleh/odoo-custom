/** @odoo-module **/

/**
 * PaymentReceipt — Dedicated Receipt Component for POS Payments/Withdrawals
 * ==========================================================================
 * A standalone receipt component (not attached to a real pos.order) that renders
 * transaction details for customer payments, withdrawals, and balance settlements.
 *
 * Unlike the standard OrderReceipt which renders from a pos.order record, this
 * component receives a plain receipt object with pre-formatted fields:
 * - customerName, customerPhone, transactionType
 * - amount (in POS currency), amountCompany (equivalent in company currency)
 * - notes, reference, date
 * - previousBalance, newBalance
 *
 * Used by PaymentReceiptPopup for on-screen preview + print.
 * Layout template: pos_ghadir.PaymentReceipt (payment_receipt.xml)
 */

import { Component } from "@odoo/owl";
import { ReceiptHeader } from "@point_of_sale/app/screens/receipt_screen/receipt/receipt_header/receipt_header";

export class PaymentReceipt extends Component {
    static template = "pos_ghadir.PaymentReceipt";
    static components = { ReceiptHeader };
    static props = {
        receipt: Object,
    };
}
