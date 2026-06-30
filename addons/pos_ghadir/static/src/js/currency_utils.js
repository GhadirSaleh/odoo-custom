/** @odoo-module **/

/**
 * Currency Formatting Utilities
 * ==============================
 *
 * Shared helpers used across multiple POS patches to format amounts
 * without trailing zeros, with the symbol placed after the number
 * (e.g. "1,234.56 $" instead of "$ 1,234.56").
 */

import { formatCurrency, getCurrency } from "@web/core/currency";

/**
 * Format an amount without trailing zeros, placing the currency symbol
 * after the number for clean Arabic-compatible display.
 *
 * Accepts either a currency record (object with .id and .symbol) or a
 * raw currency ID. Falls back to formatCurrency with no currency when
 * the input is falsy.
 *
 * @param {number} amount
 * @param {object|number|null} [currencyOrId] — res.currency record or ID
 * @returns {string} e.g. "1,234.56 $"
 */
export function formatAmountAfterSymbol(amount, currencyOrId) {
    if (currencyOrId == null) {
        return formatCurrency(amount, null, { trailingZeros: false });
    }
    const currencyId = typeof currencyOrId === 'object' ? currencyOrId.id : currencyOrId;
    const symbol = typeof currencyOrId === 'object' ? (currencyOrId.symbol || '') : '';
    const formatted = formatCurrency(amount, currencyId, { trailingZeros: false });
    if (!symbol) {
        return formatted;
    }
    const numberPart = formatted.replace(
        new RegExp(`\\s*${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g'), ''
    ).trim();
    return `${numberPart} ${symbol}`;
}
