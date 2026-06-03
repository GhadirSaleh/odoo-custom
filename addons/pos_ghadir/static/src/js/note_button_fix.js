/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import {
    NoteButton,
    InternalNoteButton,
} from "@point_of_sale/app/screens/product_screen/control_buttons/orderline_note_button/orderline_note_button";

patch(NoteButton.prototype, {
    async setChanges(selectedOrderline, payload) {
        var quantity_with_note = 0;
        const changes = this.pos.getOrderChanges();
        for (const key in changes.orderlines) {
            if (changes.orderlines[key].uuid == selectedOrderline.uuid) {
                quantity_with_note = changes.orderlines[key].quantity;
                break;
            }
        }
        const saved_quantity = selectedOrderline.qty - quantity_with_note;
        if (saved_quantity > 0 && quantity_with_note > 0) {
            await this.pos.addLineToCurrentOrder({
                product_tmpl_id: selectedOrderline.product_id.product_tmpl_id,
                qty: quantity_with_note,
                note: payload,
            });
            selectedOrderline.qty = saved_quantity;
            for (const line of selectedOrderline.combo_line_ids) {
                line.setQuantity(line.uiState.oldQty);
            }
        } else {
            this.setOrderlineNote(selectedOrderline, payload);
        }
    },

    setOrderlineNote(orderline, value) {
        return orderline.setCustomerNote(value);
    },
});

patch(InternalNoteButton.prototype, {
    setOrderlineNote(orderline, value) {
        return orderline.setNote(value);
    },
});
