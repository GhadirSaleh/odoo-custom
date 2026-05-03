/** @odoo-module */

import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/services/pos_store";

patch(PosOrder.prototype, {

    setup(vals) {
        super.setup(vals);
        var default_customer = this.config.res_partner_id;
        if(default_customer){
             var default_customer_by_id = default_customer.id;
             this.setPartner(default_customer_by_id);
        }
    },

    setPartner(partner) {
        var default_customer = this.config.res_partner_id;
        if (!default_customer){
            this.assertEditable();
        }
        this.partner_id = partner;
        this.updatePricelistAndFiscalPosition(partner);
        if (partner.is_company) {
            this.setToInvoice(true);
        }
    }
    
});

