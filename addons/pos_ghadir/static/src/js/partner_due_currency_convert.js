/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { getCurrencyRates } from "@web/core/currency";

patch(PosOrder.prototype, {
  get convertedPartnerDue() {
    const partnerDue = this.partnerBalance ?? 0;
    let orderTotal = 0;

    const isFinalized = this.finalized;
    const paidFullyWithCash =
      isFinalized &&
      this.payment_ids.length > 0 &&
      this.payment_ids.every(
        (p) => p.isDone() && p.payment_method_id.is_cash_count
      );

    if (!paidFullyWithCash) {
      orderTotal = this.totalDue ?? 0;
    }

    const posCurrency = this.currency;
    const companyCurrency = this.company?.currency_id;

    if (!companyCurrency || posCurrency.id === companyCurrency.id) {
      return Math.round((partnerDue + orderTotal) * 100) / 100;
    }

    const rate = this.models._currencyRates?.[posCurrency.id];
    if (!rate) {
      return Math.round((partnerDue + orderTotal) * 100) / 100;
    }

    const convertedOrderTotal = orderTotal * rate;
    return Math.round((partnerDue + convertedOrderTotal) * 100) / 100;
  },
});

patch(PosStore.prototype, {
  async setup() {
    await super.setup(...arguments);
    this.models._currencyRates = {};
    try {
      this.models._currencyRates = await getCurrencyRates();
    } catch (e) {
      console.error("Error fetching currency rates:", e);
    }
  },

  async calculatePartnerDue() {
    const order = this.getOrder();
    if (!order) return;

    if (
      !this.models._currencyRates ||
      Object.keys(this.models._currencyRates).length === 0
    ) {
      try {
        this.models._currencyRates = await getCurrencyRates();
      } catch (e) {
        console.error("Error fetching currency rates:", e);
      }
    }

    order.triggerRecomputeAllPrices();
  },
});
