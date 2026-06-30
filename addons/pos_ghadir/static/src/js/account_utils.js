/** @odoo-module **/

import { formatAmountAfterSymbol } from "./currency_utils";

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
