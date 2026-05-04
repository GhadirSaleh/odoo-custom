/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { reactive } from "@odoo/owl";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { SelectPartnerButton } from "@point_of_sale/app/screens/product_screen/control_buttons/select_partner_button/select_partner_button";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { xml } from "@odoo/owl";

// ---------------------------------------------------------------------------
// 1. Patch PosStore — use reactive() instead of useState() (it's a service,
//    not a component, so hooks are not allowed here)
// ---------------------------------------------------------------------------
patch(PosStore.prototype, {
  setup() {
    super.setup(...arguments);
    // reactive() works outside components; any OWL component
    // that reads .balance will automatically re-render on change
    this._partnerBalance = reactive({ balance: 0 });
  },

  get currentPartnerBalance() {
    return this._partnerBalance.balance;
  },

  async setPartnerToCurrentOrder(partner) {
    await super.setPartnerToCurrentOrder(partner);
    this._partnerBalance.balance = 0;

    if (!partner) return;

    try {
      const orm = this.env?.services?.orm;
      if (!orm) return;

      const result = await orm.read(
        "res.partner",
        [partner.id],
        ["credit", "debit"],
      );

      if (result?.length) {
        const { credit = 0, debit = 0 } = result[0];
        this._partnerBalance.balance = credit - debit;
      }
    } catch (error) {
      console.error("Error fetching partner balance:", error);
    }
  },
});

// ---------------------------------------------------------------------------
// 2. SelectPartnerButton — no changes needed here, reactive() above is enough
// ---------------------------------------------------------------------------
patch(SelectPartnerButton, {
  template: xml`
        <button
            class="set-partner btn btn-secondary btn-lg lh-lg text-truncate w-auto"
            t-on-click="() => this.pos.selectPartner()"
        >
            <t t-if="props.partner">
                <span class="text-truncate text-action" t-esc="props.partner.name"/>
                <t t-if="pos.currentPartnerBalance !== 0">
                    <span class="ms-1 text-muted">
                        (<t t-esc="pos.currentPartnerBalance.toFixed(2)"/>$)
                    </span>
                </t>
            </t>
            <t t-else="">Customer</t>
        </button>
    `,
});
