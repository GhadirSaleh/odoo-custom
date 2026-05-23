/** @odoo-module **/

/**
 * Disable Price Override Button on Numpad
 * ========================================
 * Patches: ProductScreen.getNumpadButtons
 *
 * Problem: By default, the POS numpad includes a "price" button that lets
 * cashiers override the product price manually. For this business, prices
 * should be fixed and not modifiable at the point of sale.
 *
 * Solution: Intercept getNumpadButtons and set `disabled: true` on the
 * button whose value is "price". The button remains visible but is
 * non-interactive.
 *
 * Note: The SCSS file also hides the price input via `.numpad-price { visibility: hidden }`
 * as an extra safeguard.
 */

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
