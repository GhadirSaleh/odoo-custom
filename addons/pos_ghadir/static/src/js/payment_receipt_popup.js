/** @odoo-module **/

/**
 * PaymentReceiptPopup — Receipt Preview/Print Dialog for Account Transactions
 * =============================================================================
 * Displays a modal dialog showing the receipt for a customer payment, withdrawal,
 * or balance settlement. Provides Print and Close buttons.
 *
 * Key behaviors:
 * - Print button: Calls the printer service with the PaymentReceipt component.
 * - Close button: Calls getPayload(true) (print) or getPayload() (close only)
 *   to unblock the caller (which is awaiting via makeAwaitable).
 * - The caller creates a dummy pos.order record to pass to the popup, then
 *   deletes it after the popup closes (see customer_account_screens.js).
 *
 * Used by: CustomerAccountStatementScreen for payment, withdrawal, and settle balance flows.
 */

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { Dialog } from "@web/core/dialog/dialog";
import { PaymentReceipt } from "./payment_receipt";

export class PaymentReceiptPopup extends Component {
    static template = "pos_ghadir.PaymentReceiptPopup";
    static components = { Dialog, PaymentReceipt };
    static props = {
        receipt: Object,
        close: Function,
        getPayload: { type: Function, optional: true },
    };

    setup() {
        this._t = _t;
        this.printer = useService("printer");
        this.notification = useService("notification");
    }

    async printReceipt() {
        try {
            await this.printer.print(PaymentReceipt, {
                receipt: this.props.receipt,
            }, { webPrintFallback: true });
        } catch (e) {
            console.error("Error printing receipt:", e);
            this.notification.add(_t("Error printing receipt"), { type: "danger" });
        }
        this.props.getPayload?.(true);
        this.props.close();
    }

    close() {
        this.props.getPayload?.();
        this.props.close();
    }
}
