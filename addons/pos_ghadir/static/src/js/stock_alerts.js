/** @odoo-module **/
import { patch } from "@web/core/utils/patch";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { PosData } from "@point_of_sale/app/services/data_service";
import { ProductCard } from "@point_of_sale/app/components/product_card/product_card";
import OrderPaymentValidation from "@point_of_sale/app/utils/order_payment_validation";

patch(ProductCard.prototype, {
    setup() {
        this.pos = usePos();
    },
    get stockLevel() {
        const product = this.props.product;
        if (!product) return null;
        const isStorable = product.is_storable ?? product.product_tmpl_id?.is_storable ?? false;
        if (!isStorable) return null;
        if (!this.pos?.config?.pos_show_stock_alerts) return null;
        const qty = product.qty_available ?? product.product_tmpl_id?.qty_available ?? 0;
        if (qty <= 0) return 'out';
        const threshold = this.pos.config.pos_low_stock_threshold || 5;
        if (qty <= threshold) return 'low';
        return 'ok';
    },
    get stockQty() {
        const product = this.props.product;
        if (!product) return null;
        const qty = product.qty_available ?? product.product_tmpl_id?.qty_available;
        return qty != null ? qty : null;
    },
});

/**
 * Post-order stock refresh
 * After each validated order, fetch current stock for all ordered products
 * and update both the variant and its template.
 */
patch(OrderPaymentValidation.prototype, {
    async afterOrderValidation() {
        await super.afterOrderValidation(...arguments);
        await this._refreshProductStock();
    },
    async _refreshProductStock() {
        const order = this.order;
        if (!order || !order.lines) return;

        const productIds = [...new Set(
            order.lines
                .map(l => l.product_id?.id)
                .filter(Boolean)
        )];
        if (productIds.length === 0) return;

        const stockData = await this.pos.data.call(
            "product.product", "get_stock_for_pos", [productIds]
        );
        if (!stockData) return;

        for (const [pId, data] of Object.entries(stockData)) {
            const variant = this.pos.models["product.product"].get(parseInt(pId));
            if (!variant) continue;
            variant.qty_available = data.qty_available;
            if (variant.product_tmpl_id) {
                variant.product_tmpl_id.qty_available = data.qty_available;
            }
        }
    },
});

/**
 * Initial bulk stock fetch
 * Runs once at POS session start (after all product data is loaded).
 * Fetches stock for all storable products in chunks of 200.
 */
patch(PosData.prototype, {
    async intializeDataRelation() {
        await super.intializeDataRelation(...arguments);
        if (!this.network.offline) {
            await this._fetchAllStock();
        }
    },
    async _fetchAllStock() {
        const config = this.models["pos.config"]?.get(odoo.pos_config_id);
        if (!config?.pos_show_stock_alerts) return;
        const variants = this.models["product.product"]?.getAll() || [];
        const storableIds = variants.filter(p => p.is_storable ?? p.product_tmpl_id?.is_storable ?? false).map(p => p.id);
        if (storableIds.length === 0) return;
        const chunkSize = 200;
        for (let i = 0; i < storableIds.length; i += chunkSize) {
            const chunk = storableIds.slice(i, i + chunkSize);
            const stockData = await this.orm.call(
                "product.product", "get_stock_for_pos", [chunk]
            );
            if (!stockData) continue;
            for (const [pId, data] of Object.entries(stockData)) {
                const variant = this.models["product.product"].get(parseInt(pId));
                if (!variant) continue;
                variant.qty_available = data.qty_available;
                if (variant.product_tmpl_id) {
                    variant.product_tmpl_id.qty_available = data.qty_available;
                }
            }
        }
    },
});
