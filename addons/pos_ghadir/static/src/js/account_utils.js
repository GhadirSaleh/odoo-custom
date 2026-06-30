/** @odoo-module **/

/**
 * Account Utilities
 * ==================
 * Shared helpers for customer account screens, extracted to eliminate
 * method duplication between CustomerAccountListScreen and
 * CustomerAccountStatementScreen.
 *
 * Exports:
 * - formatBalance(pos, amount)         — format in company currency
 * - formatPosBalance(pos, amount)      — format in POS currency
 * - isMultiCurrency(pos)               — check if POS != company currency
 * - convertToPosCurrency(pos, amount)  — convert company → POS via internal rate
 * - showPaymentReceipt(dialog, pos, receiptProps)
 *   Creates a dummy pos.order, displays a PaymentReceiptPopup, then
 *   deletes the dummy order. Wraps the create-dispose cycle shared by
 *   makePayment, withdraw, and settleBalance flows.
 */

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
