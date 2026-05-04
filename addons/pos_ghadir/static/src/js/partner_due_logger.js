/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { reactive } from "@odoo/owl";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { SelectPartnerButton } from "@point_of_sale/app/screens/product_screen/control_buttons/select_partner_button/select_partner_button";
import { xml } from "@odoo/owl";

// ---------------------------------------------------------------------------
// 1. Patch PosStore — use reactive() instead of useState() (it's a service,
//    not a component, so hooks are not allowed here)
// ---------------------------------------------------------------------------
patch(PosStore.prototype, {
  get currentPartnerBalance() {
    return this._partnerBalance?.balance ?? 0;
  },

  async setPartnerToCurrentOrder(partner) {
    await super.setPartnerToCurrentOrder(partner);

    // Lazy init — no setup() required
    if (!this._partnerBalance) {
      this._partnerBalance = reactive({ balance: 0 });
    }
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

  get partnerBalanceClass() {
    const bal = this._partnerBalance?.balance ?? 0;
    if (bal > 0) return "text-success";
    if (bal < 0) return "text-danger";
    return "text-muted";
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
                    <span t-att-class="'ms-1 ' + pos.partnerBalanceClass">
                        $(<t t-esc="pos.currentPartnerBalance.toFixed(2)"/>)
                    </span>
                </t>
            </t>
            <t t-else="">Customer</t>
        </button>
    `,
});
