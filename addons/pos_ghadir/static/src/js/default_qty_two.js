/** @odoo-module **/

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
