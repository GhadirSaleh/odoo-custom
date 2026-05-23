/** @odoo-module **/

/**
 * Prevent Empty Payment Lines on Payment Screen
 * ==============================================
 * Patches: PaymentScreen.addNewPaymentLine
 *
 * Problem: When the order is fully paid (remainingDue === 0), clicking a
 * payment method button would still create a payment line with amount 0,
 * resulting in empty/meaningless lines on the payment screen.
 *
 * Solution: Intercept addNewPaymentLine, check if remainingDue is zero.
 * If so, show a non-blocking toast notification instead of creating an
 * empty payment line. This avoids the need for the user to dismiss an
 * error dialog.
 */

import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { _t } from "@web/core/l10n/translation";

patch(PaymentScreen.prototype, {
    addNewPaymentLine(paymentMethod) {
        // If nothing is owed, skip creating a payment line entirely
        if (!this.currentOrder.remainingDue) {
            this.notification.add(_t("The order is fully paid."), { type: "info" });
            return false;
        }
        return super.addNewPaymentLine(paymentMethod);
    },
});
