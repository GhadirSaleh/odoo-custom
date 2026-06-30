/** @odoo-module **/

import { formatAmountAfterSymbol } from "./currency_utils";
import { makeAwaitable } from "@point_of_sale/app/utils/make_awaitable_dialog";
import { PaymentReceiptPopup } from "./payment_receipt_popup";

export function formatBalance(pos, amount) {
    return formatAmountAfterSymbol(amount, pos.company.currency_id);
}

export function formatPosBalance(pos, amount) {
    return formatAmountAfterSymbol(amount, pos.currency);
}

export function isMultiCurrency(pos) {
    return pos.currency.id !== pos.company.currency_id.id;
}

export function convertToPosCurrency(pos, companyAmount) {
    const rate = pos.models._currencyRates?.[pos.currency.id];
    if (!rate || rate === 0) return companyAmount;
    return companyAmount / rate;
}

export async function showPaymentReceipt(dialog, pos, receiptProps) {
    const dummyOrder = pos.models["pos.order"].create({
        session_id: pos.session,
        company_id: pos.company,
        config_id: pos.config,
        user_id: pos.user,
        ticket_code: "",
        tracking_number: "",
        sequence_number: 0,
        pos_reference: receiptProps.reference || "",
    });
    await makeAwaitable(dialog, PaymentReceiptPopup, {
        receipt: { ...receiptProps, order: dummyOrder },
    });
    pos.models["pos.order"].delete(dummyOrder);
}
