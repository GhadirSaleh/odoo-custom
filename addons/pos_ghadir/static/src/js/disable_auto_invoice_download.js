/** @odoo-module **/

/**
 * Disable Automatic Invoice PDF Download
 * =======================================
 * Patches: OrderPaymentValidation.shouldDownloadInvoice
 *
 * Problem: After order validation, Odoo automatically downloads the invoice
 * PDF. This interrupts the cashier's workflow, especially in high-volume
 * environments where printing receipts is sufficient.
 *
 * Solution: Override shouldDownloadInvoice to always return false, preventing
 * the automatic PDF download. The invoice is still created in the backend;
 * it just won't be downloaded to the browser automatically.
 *
 * Note: Users can still manually download invoices from the backend if needed.
 */

import { patch } from "@web/core/utils/patch";
import OrderPaymentValidation from "@point_of_sale/app/utils/order_payment_validation";

patch(OrderPaymentValidation.prototype, {
    shouldDownloadInvoice() {
        // Prevent automatic invoice PDF download
        return false;
    },
});
