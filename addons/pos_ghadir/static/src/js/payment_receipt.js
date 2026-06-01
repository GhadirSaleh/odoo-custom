/** @odoo-module **/

import { Component } from "@odoo/owl";
import { ReceiptHeader } from "@point_of_sale/app/screens/receipt_screen/receipt/receipt_header/receipt_header";

export class PaymentReceipt extends Component {
    static template = "pos_ghadir.PaymentReceipt";
    static components = { ReceiptHeader };
    static props = {
        receipt: Object,
    };
}
