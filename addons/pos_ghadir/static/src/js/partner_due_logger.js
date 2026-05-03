/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { SelectPartnerButton } from "@point_of_sale/app/screens/product_screen/control_buttons/select_partner_button/select_partner_button";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import OrderPaymentValidation from "@point_of_sale/app/utils/order_payment_validation";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { xml } from "@odoo/owl";
import { onMounted } from "@odoo/owl";

// Patch PosStore to store partner balance and fetch it
patch(PosStore.prototype, {
    currentPartnerBalance: 0,
    
    async setPartnerToCurrentOrder(partner) {
        await super.setPartnerToCurrentOrder(partner);
        this.currentPartnerBalance = 0;
        if (partner) {
            try {
                const orm = this.env?.services?.orm;
                if (orm) {
                    const result = await orm.call("res.partner", "read", [[partner.id], ["credit", "debit"]]);
                    if (result?.length) {
                        const { credit, debit } = result[0];
                        this.currentPartnerBalance = (credit || 0) - (debit || 0);
                    }
                }
            } catch (error) {
                console.error("Error fetching partner balance:", error);
            }
        }
    },
});

// Patch SelectPartnerButton template (product screen) to show balance
patch(SelectPartnerButton, {
    template: xml`
        <button class="set-partner btn btn-secondary btn-lg lh-lg text-truncate w-auto" t-on-click="() => this.pos.selectPartner()">
            <t t-if="props.partner">
                <span t-esc="props.partner.name" class="text-truncate text-action" />
                <span class="ms-1" t-if="pos.currentPartnerBalance">(<t t-esc="pos.currentPartnerBalance.toFixed(2)"/>$)</span>
            </t>
            <t t-else="">Customer</t>
        </button>
    `,
});

// Patch PaymentScreen to update partner button text with balance
patch(PaymentScreen.prototype, {
    setup() {
        super.setup(...arguments);
        
        // Update partner button text after component is mounted
        onMounted(() => {
            this._updatePaymentScreenPartnerButton();
        });
    },
    
    _updatePaymentScreenPartnerButton() {
        const partner = this.currentOrder?.getPartner();
        if (!partner) return;
        
        // Find the partner button name span in the payment screen
        const partnerNameSpan = document.querySelector(".payment-screen .partner-name");
        if (partnerNameSpan) {
            const balance = this.pos.currentPartnerBalance || 0;
            const balanceText = balance !== 0 ? ` (${balance.toFixed(2)}$)` : "";
            partnerNameSpan.textContent = `${partner.name}${balanceText}`;
        }
    },
    
    // Override to update button after partner is selected
    async selectPartner() {
        const result = await super.selectPartner(...arguments);
        return result;
    },
});

// Patch OrderPaymentValidation to prevent automatic invoice PDF download
patch(OrderPaymentValidation.prototype, {
    shouldDownloadInvoice() {
        // Prevent automatic invoice PDF download
        return false;
    },
});

// Patch PosOrder to make invoice button active by default
patch(PosOrder.prototype, {
    setup(vals) {
        super.setup(vals);
        // Make invoice button active by default if config allows invoicing
        if (this.config && this.config.canInvoice) {
            this.to_invoice = true;
        }
    },
});
