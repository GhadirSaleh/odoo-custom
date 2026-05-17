/** @odoo-module **/

import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { patch } from "@web/core/utils/patch";

patch(ProductScreen.prototype, {
  getNumpadButtons() {
    const buttons = super.getNumpadButtons();

    return buttons.map((btn) => {
      if (btn.value === "price") {
        return {
          ...btn,
          disabled: true,
        };
      }
      return btn;
    });
  },
});
