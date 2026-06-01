/** @odoo-module **/

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
