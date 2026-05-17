/** @odoo-module **/
import { patch } from "@web/core/utils/patch";
import OrderPaymentValidation from "@point_of_sale/app/utils/order_payment_validation";

// Patch OrderPaymentValidation to prevent automatic invoice PDF download
patch(OrderPaymentValidation.prototype, {
  shouldDownloadInvoice() {
    // Prevent automatic invoice PDF download
    return false;
  },
});
