/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";

// Patch PosOrder to make invoice button active by default
patch(PosOrder.prototype, {
  setup(vals) {
    super.setup(vals);
    // Make invoice button active by default if config allows invoicing
    if (this.config && this.config.canInvoice) {
      this.to_invoice = true;
    }
  },
});
