/** @odoo-module **/

/**
 * Customer Account Screens
 * ========================
 * Components: NotesPopup, CustomerAccountListScreen, CustomerAccountStatementScreen
 * Routes: /customer-accounts, /customer-accounts/{customerId}
 *
 * Provides a full customer account management interface within the POS:
 *
 * 1. CustomerAccountListScreen — Searchable list of all customers with their
 *    real-time credit/debit balances. Supports multi-currency display.
 *
 * 2. CustomerAccountStatementScreen — Detailed accounting history for a
 *    single customer, showing all posted move lines with running balance.
 *    Supports two actions:
 *    - Make Payment: Creates a journal entry that credits the customer's
 *      receivable account (reduces their balance).
 *    - Withdraw (Adjustment): Creates a journal entry that debits the
 *      customer's receivable account (increases their balance). Requires
 *      mandatory notes for audit trail.
 *
 * 3. NotesPopup — Reusable dialog for capturing optional/required notes.
 *    Used by payment and adjustment flows.
 *
 * Backend calls (via ORM):
 * - get_customers_with_balances(query, limit) → list of customer dicts
 * - get_partner_info(partner_id) → single customer dict
 * - get_account_history(partner_id) → list of move line dicts with running balance
 * - create_customer_payment(partner_id, amount, notes, config_id, currency_id)
 * - create_customer_adjustment(partner_id, type, amount, notes, config_id, currency_id)
 *
 * Multi-currency: When POS currency differs from company currency, the user
 * is prompted to select which currency to use for payments/withdrawals.
 * Amounts are converted on the backend using Odoo's currency rate system.
 *
 * Shared methods between ListScreen and StatementScreen (could be extracted
 * into a mixin in a future refactor):
 * - formatBalance(amount) — format in company currency
 * - formatPosBalance(amount) — format in POS currency
 * - isMultiCurrency() — check if POS currency differs from company currency
 * - convertToPosCurrency(companyAmount) — convert using stored exchange rates
 */

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { Component, useState, onMounted } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { formatCurrency, getCurrency } from "@web/core/currency";
import { Dialog } from "@web/core/dialog/dialog";
import { NumberPopup } from "@point_of_sale/app/components/popups/number_popup/number_popup";
import { SelectionPopup } from "@point_of_sale/app/components/popups/selection_popup/selection_popup";
import { makeAwaitable } from "@point_of_sale/app/utils/make_awaitable_dialog";

// Helper: format amount as "1,234.56 $" (number, space, symbol)
function formatCurrencyAmount(amount, currency) {
    const formatted = formatCurrency(amount, currency.id, { trailingZeros: false });
    const symbol = currency.symbol || "";
    const numberPart = formatted.replace(new RegExp(`\\s*${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, "g"), "").trim();
    return `${numberPart} ${symbol}`;
}

/**
 * NotesPopup — Dialog for capturing free-text notes.
 *
 * @param {String} props.title — Dialog title and textarea placeholder
 * @param {Boolean} props.required — If true, notes cannot be empty on confirm
 * @param {Function} props.close — Owl close function
 * @param {Function} props.getPayload — Callback to receive the notes string
 */
export class NotesPopup extends Component {
    static template = "pos_ghadir.NotesPopup";
    static components = { Dialog };
    static props = {
        title: String,
        required: { type: Boolean, optional: true },
        close: Function,
        getPayload: Function,
    };
    static defaultProps = {
        required: false,
    };

    setup() {
        this.state = useState({ notes: "" });
    }

    confirm() {
        if (this.props.required && !this.state.notes.trim()) {
            return;
        }
        this.props.getPayload(this.state.notes.trim());
        this.props.close();
    }

    cancel() {
        this.props.getPayload(null);
        this.props.close();
    }
}

/**
 * CustomerAccountListScreen — Searchable customer list with balances.
 *
 * Loads customers from the backend with their credit/debit balances.
 * Clicking a customer navigates to their statement screen.
 */
export class CustomerAccountListScreen extends Component {
    static template = "pos_ghadir.CustomerAccountListScreen";

    setup() {
        this.pos = usePos();
        this.dialog = useService("dialog");
        this.notification = useService("notification");
        this.orm = useService("orm");
        this.state = useState({
            query: "",
            customers: [],
            loading: false,
        });
        onMounted(async () => {
            await this.loadCustomers();
        });
    }

    async loadCustomers() {
        this.state.loading = true;
        try {
            // Fetch customer list from backend
            const customers = await this.orm.call(
                "res.partner",
                "get_customers_with_balances",
                [this.state.query, 100]
            );

            // Fetch actual credit/debit from accounting (backend only returns basic info)
            if (customers.length > 0) {
                const partnerIds = customers.map(c => c.id);
                const partnerData = await this.orm.read(
                    "res.partner",
                    partnerIds,
                    ["credit", "debit"]
                );

                const balanceMap = {};
                for (const pd of partnerData) {
                    const credit = pd.credit || 0;
                    const debit = pd.debit || 0;
                    balanceMap[pd.id] = credit - debit;
                }

                for (const customer of customers) {
                    customer.balance = balanceMap[customer.id] || 0;
                }
            }

            this.state.customers = customers;
        } catch (e) {
            console.error("Error loading customers:", e);
            this.notification.add(_t("Error loading customers"), { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }

    onSearch() {
        this.loadCustomers();
    }

    openCustomerStatement(customer) {
        this.pos.navigate("CustomerAccountStatementScreen", { customerId: customer.id });
    }

    goBack() {
        this.pos.navigate("ProductScreen", { orderUuid: this.pos.getOrder()?.uuid });
    }

    formatBalance(amount) {
        return formatCurrencyAmount(amount, this.pos.company.currency_id);
    }

    formatPosBalance(amount) {
        return formatCurrencyAmount(amount, this.pos.currency);
    }

    getCustomerBalanceClass(balance) {
        if (balance > 0) return "text-danger fw-bold";
        if (balance < 0) return "text-success fw-bold";
        return "text-muted fw-bold";
    }

    isMultiCurrency() {
        return this.pos.currency.id !== this.pos.company.currency_id.id;
    }

    convertToPosCurrency(companyAmount) {
        const rate = this.pos.models._currencyRates?.[this.pos.currency.id];
        if (!rate || rate === 0) return companyAmount;
        return companyAmount / rate;
    }
}

/**
 * CustomerAccountStatementScreen — Detailed accounting history per customer.
 *
 * Shows all posted accounting move lines for the customer's receivable/payable
 * accounts with a running balance. Supports payments and adjustments.
 */
export class CustomerAccountStatementScreen extends Component {
    static template = "pos_ghadir.CustomerAccountStatementScreen";

    setup() {
        this.pos = usePos();
        this.dialog = useService("dialog");
        this.notification = useService("notification");
        this.orm = useService("orm");
        this.state = useState({
            customer: null,
            balance: 0,
            transactions: [],
            loading: false,
        });
        onMounted(async () => {
            await this.loadStatement();
        });
    }

    async loadStatement() {
        this.state.loading = true;
        try {
            const customerId = this.pos.router.state.params.customerId;
            const customer = await this.orm.call("res.partner", "get_partner_info", [customerId]);
            if (!customer) {
                this.notification.add(_t("Customer not found"), { type: "danger" });
                this.goBack();
                return;
            }

            // Fetch current balance from accounting
            const partnerData = await this.orm.read(
                "res.partner",
                [customerId],
                ["credit", "debit"]
            );

            let balance = 0;
            if (partnerData.length > 0) {
                const credit = partnerData[0].credit || 0;
                const debit = partnerData[0].debit || 0;
                balance = credit - debit;
            }

            // Fetch full accounting history
            const transactions = await this.orm.call("res.partner", "get_account_history", [customerId]);

            this.state.customer = customer;
            this.state.balance = balance;
            this.state.transactions = transactions;
        } catch (e) {
            console.error("Error loading statement:", e);
            this.notification.add(_t("Error loading statement"), { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }

    goBack() {
        this.pos.navigate("CustomerAccountListScreen");
    }

    /**
     * Make Payment — Creates a journal entry that reduces the customer's balance.
     *
     * Flow: select currency (if multi-currency) → enter amount → optional notes
     * → backend creates and posts the account.move.
     */
    async makePayment() {
        if (!this.state.customer) return;

        let selectedCurrencyId = false;
        if (this.isMultiCurrency()) {
            const currencyList = this.getAvailableCurrencies("payment");
            const selected = await makeAwaitable(this.dialog, SelectionPopup, {
                title: _t("Select Payment Currency"),
                list: currencyList,
            });
            if (selected === undefined) return;
            selectedCurrencyId = selected.id;
        }

        const currencyId = selectedCurrencyId || this.pos.currency.id;
        const currencyName = this.getCurrencyById(currencyId).name;
        const amountStr = await makeAwaitable(this.dialog, NumberPopup, {
            title: _t("Make Payment"),
            subtitle: _t("Enter amount in %s", [currencyName]),
            startingValue: "",
        });

        if (amountStr === undefined) return;
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) return;

        const notes = await this.promptForNotes(_t("Payment notes (optional)"));

        try {
            const result = await this.orm.call("res.partner", "create_customer_payment", [
                this.state.customer.id,
                amount,
                notes || _t("Payment via POS"),
                this.pos.config.id,
                selectedCurrencyId,
            ]);

            if (result.error) {
                this.notification.add(_t(result.error), { type: "danger" });
                return;
            }

            const paidCurrency = getCurrency(result.currency_id);
            const paidFormatted = paidCurrency ? formatCurrencyAmount(result.amount_paid, paidCurrency) : String(result.amount_paid);
            const companyCurrency = getCurrency(result.company_currency_id);
            const companyFormatted = companyCurrency ? formatCurrencyAmount(result.amount_company, companyCurrency) : String(result.amount_company);
            const customerName = this.state.customer.name;
            this.notification.add(
                _t("Payment of %s recorded for %s\nEquivalent: %s", [paidFormatted, customerName, companyFormatted]),
                { type: "success" }
            );
            await this.loadStatement();
        } catch (e) {
            console.error("Error making payment:", e);
            this.notification.add(_t("Error processing payment"), { type: "danger" });
        }
    }

    /**
     * Withdraw — Creates a journal entry that increases the customer's balance.
     *
     * Same flow as makePayment, but notes are mandatory for audit trail.
     * Uses create_customer_adjustment with type "adjustment_add".
     */
    async withdraw() {
        if (!this.state.customer) return;

        let selectedCurrencyId = false;
        if (this.isMultiCurrency()) {
            const currencyList = this.getAvailableCurrencies("withdraw");
            const selected = await makeAwaitable(this.dialog, SelectionPopup, {
                title: _t("Select Withdrawal Currency"),
                list: currencyList,
            });
            if (selected === undefined) return;
            selectedCurrencyId = selected.id;
        }

        const currencyId = selectedCurrencyId || this.pos.currency.id;
        const currencyName = this.getCurrencyById(currencyId).name;
        const amountStr = await makeAwaitable(this.dialog, NumberPopup, {
            title: _t("Withdraw"),
            subtitle: _t("Enter amount in %s", [currencyName]),
            startingValue: "",
        });

        if (amountStr === undefined) return;
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) return;

        const notes = await this.promptForNotes(_t("Withdrawal notes (optional)"));
        if (notes === null) return;

        try {
            const result = await this.orm.call("res.partner", "create_customer_adjustment", [
                this.state.customer.id,
                "adjustment_add",
                amount,
                notes,
                this.pos.config.id,
                selectedCurrencyId,
            ]);

            if (result.error) {
                this.notification.add(_t(result.error), { type: "danger" });
                return;
            }

            const paidCurrency = getCurrency(result.currency_id);
            const paidFormatted = paidCurrency ? formatCurrencyAmount(result.amount_paid, paidCurrency) : String(result.amount_paid);
            const companyCurrency = getCurrency(result.company_currency_id);
            const companyFormatted = companyCurrency ? formatCurrencyAmount(result.amount_company, companyCurrency) : String(result.amount_company);
            const customerName = this.state.customer.name;
            this.notification.add(
                _t("Withdrawal of %s recorded for %s\nEquivalent: %s", [paidFormatted, customerName, companyFormatted]),
                { type: "success" }
            );
            await this.loadStatement();
        } catch (e) {
            console.error("Error processing withdrawal:", e);
            this.notification.add(_t("Error processing withdrawal"), { type: "danger" });
        }
    }

    async promptForNotes(label, required = false) {
        return await makeAwaitable(this.dialog, NotesPopup, {
            title: label,
            required: required,
            getPayload: (payload) => payload,
        });
    }

    formatDate(dateStr) {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        const datePart = date.toLocaleDateString();
        const timePart = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return { date: datePart, time: timePart };
    }

    formatBalance(amount) {
        return formatCurrencyAmount(amount, this.pos.company.currency_id);
    }

    formatPosBalance(amount) {
        return formatCurrencyAmount(amount, this.pos.currency);
    }

    getBalanceClass() {
        if (this.state.balance > 0) return "text-danger";
        if (this.state.balance < 0) return "text-success";
        return "text-muted";
    }

    getTransactionBalanceClass(balance) {
        if (balance > 0) return "text-danger";
        if (balance < 0) return "text-success";
        return "text-muted";
    }

    isMultiCurrency() {
        return this.pos.currency.id !== this.pos.company.currency_id.id;
    }

    convertToPosCurrency(companyAmount) {
        const rate = this.pos.models._currencyRates?.[this.pos.currency.id];
        if (!rate || rate === 0) return companyAmount;
        return companyAmount / rate;
    }

    getPosBalance() {
        return this.convertToPosCurrency(this.state.balance);
    }

    /**
     * Build currency selection list for payment/withdrawal dialogs.
     * Always includes POS currency; adds company currency if different.
     */
    getAvailableCurrencies(actionType) {
        const posCurrency = this.pos.currency;
        const companyCurrency = this.pos.company.currency_id;
        const actionLabel = actionType === "payment" ? _t("Pay in") : _t("Withdraw in");
        const currencies = [];

        currencies.push({
            id: posCurrency.id,
            label: `${actionLabel} ${posCurrency.name}`,
            description: posCurrency.symbol,
            item: posCurrency,
            isSelected: true,
        });

        if (companyCurrency.id !== posCurrency.id) {
            currencies.push({
                id: companyCurrency.id,
                label: `${actionLabel} ${companyCurrency.name}`,
                description: companyCurrency.symbol,
                item: companyCurrency,
                isSelected: false,
            });
        }

        return currencies;
    }

    getCurrencyById(currencyId) {
        if (this.pos.currency.id === currencyId) {
            return this.pos.currency;
        }
        if (this.pos.company.currency_id.id === currencyId) {
            return this.pos.company.currency_id;
        }
        return this.pos.currency;
    }
}

// Register routes for the two screens
registry.category("pos_pages").add("CustomerAccountListScreen", {
    name: "CustomerAccountListScreen",
    component: CustomerAccountListScreen,
    route: `/pos/ui/${odoo.pos_config_id}/customer-accounts`,
    params: {},
});

registry.category("pos_pages").add("CustomerAccountStatementScreen", {
    name: "CustomerAccountStatementScreen",
    component: CustomerAccountStatementScreen,
    route: `/pos/ui/${odoo.pos_config_id}/customer-accounts/{int:customerId}`,
    params: {},
});
