/** @odoo-module **/

/**
 * Default Product Quantity of 2
 * ==============================
 * Patches: ProductScreen.addProductToOrder
 *
 * Problem: By default, Odoo POS adds products with quantity 1. For this
 * business, the most common purchase quantity is 2.
 *
 * Solution: Override addProductToOrder to pass qty: 2 instead of the default 1.
 *
 * Important distinction:
 * - Manual click on a product tile → qty is set to 2 (this patch)
 * - Barcode scan of a product → qty is set to 1 (bypasses this method,
 *   goes through barcode handler instead)
 *
 * This ensures barcode scanning still works normally (one scan = one item)
 * while manual selection defaults to 2.
 */

import { patch } from "@web/core/utils/patch";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";

patch(ProductScreen.prototype, {
    async addProductToOrder(product) {
        const options = {};
        if (this.searchWord && product.isConfigurable()) {
            const barcode = this.searchWord;
            const searchedProduct = product.product_variant_ids.filter(
                (p) => p.barcode && p.barcode.includes(barcode)
            );
            if (searchedProduct.length === 1) {
                options["presetVariant"] = searchedProduct[0];
            }
        }
        // Manual click: default qty to 2 instead of 1
        await this.pos.addLineToCurrentOrder(
            { product_tmpl_id: product, qty: 2 },
            options,
        );
        this.showOptionalProductPopupIfNeeded(product);
    },
});
