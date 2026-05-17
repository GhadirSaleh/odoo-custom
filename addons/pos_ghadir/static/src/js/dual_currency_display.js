/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { OrderDisplay } from "@point_of_sale/app/components/order_display/order_display";
import { formatCurrency } from "@web/core/currency";

patch(PosOrder.prototype, {
  get convertedTotal() {
    const posCurrency = this.currency;
    const companyCurrency = this.company?.currency_id;

    if (!companyCurrency || posCurrency.id === companyCurrency.id) {
      return null;
    }

    const rate = this.models._currencyRates?.[posCurrency.id];
    if (!rate || rate === 1) {
      return null;
    }

    const total = this.totalDue ?? 0;
    const converted = total * rate;
    return Math.round(converted * 100) / 100;
  },

  get formattedConvertedTotal() {
    const converted = this.convertedTotal;
    if (converted === null) {
      return "";
    }
    const companyCurrency = this.company?.currency_id;
    if (!companyCurrency) {
      return "";
    }
    return formatCurrency(converted, companyCurrency.id, {
      trailingZeros: false,
    });
  },
});

patch(PosStore.prototype, {
  async setup() {
    await super.setup(...arguments);
    if (!this.models._currencyRates) {
      this.models._currencyRates = {};
    }
  },
});

patch(OrderDisplay.prototype, {
  get convertedTotalDisplay() {
    const order = this.props.order;
    if (!order) return "";
    return order.formattedConvertedTotal || "";
  },
});
