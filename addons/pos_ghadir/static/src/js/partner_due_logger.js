/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { SelectPartnerButton } from "@point_of_sale/app/screens/product_screen/control_buttons/select_partner_button/select_partner_button";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { xml } from "@odoo/owl";

patch(PosStore.prototype, {
  setup() {
    super.setup(...arguments);
    this.currentPartnerBalance = 0;
  },

  async setPartnerToCurrentOrder(partner) {
    await super.setPartnerToCurrentOrder(partner);

    this.currentPartnerBalance = 0;

    if (!partner) return;

    try {
      const orm = this.env.services.orm;

      const [res] = await orm.call("res.partner", "read", [
        [partner.id],
        ["credit", "debit"],
      ]);

      if (res) {
        const { credit = 0, debit = 0 } = res;
        this.currentPartnerBalance = credit - debit;

        // 🔥 force UI update
        this.trigger("update");
      }
    } catch (err) {
      console.error("Partner balance fetch failed:", err);
    }
  },

  getPartnerBalance() {
    return this.currentPartnerBalance || 0;
  },
});

patch(SelectPartnerButton, {
  template: xml`
        <button class="set-partner btn btn-secondary btn-lg lh-lg text-truncate w-auto"
                t-on-click="() => this.pos.selectPartner()">
            
            <t t-if="props.partner">
                <span t-esc="props.partner.name" class="text-truncate text-action"/>
                
                <t t-if="pos.getPartnerBalance()">
                    <span class="ms-1">
                        (<t t-esc="pos.getPartnerBalance().toFixed(2)"/>$)
                    </span>
                </t>
            </t>
            
            <t t-else="">Customer</t>
        </button>
    `,
});

patch(PaymentScreen, {
  template: xml`
        <t t-inherit="point_of_sale.PaymentScreen" t-inherit-mode="extension">
            
            <xpath expr="//span[contains(@class, 'partner-name')]" position="replace">
                <span class="partner-name">
                    <t t-set="partner" t-value="currentOrder.getPartner()"/>

                    <t t-if="partner">
                        <t t-esc="partner.name"/>
                        
                        <t t-if="pos.getPartnerBalance()">
                            (<t t-esc="pos.getPartnerBalance().toFixed(2)"/>$)
                        </t>
                    </t>
                </span>
            </xpath>

        </t>
    `,
});

