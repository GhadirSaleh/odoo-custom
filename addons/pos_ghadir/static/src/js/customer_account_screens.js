/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { Component, useState, onMounted } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { formatCurrency } from "@web/core/currency";
import { Dialog } from "@web/core/dialog/dialog";
import { NumberPopup } from "@point_of_sale/app/components/popups/number_popup/number_popup";
import { makeAwaitable } from "@point_of_sale/app/utils/make_awaitable_dialog";

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
        this.props.getPayload(this.props.required ? null : "");
        this.props.close();
    }
}

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
            const customers = await this.orm.call(
                "res.partner",
                "get_customers_with_balances",
                [this.state.query, 100]
            );

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
        return formatCurrency(amount, this.pos.company.currency_id.id, { trailingZeros: false });
    }

    getCustomerBalanceClass(balance) {
        if (balance > 0) return "text-danger fw-bold";
        if (balance < 0) return "text-success fw-bold";
        return "text-muted fw-bold";
    }
}

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

    async makePayment() {
        if (!this.state.customer) return;

        const amountStr = await makeAwaitable(this.dialog, NumberPopup, {
            title: _t("Make Payment"),
            subtitle: _t("Enter payment amount"),
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
            ]);

            if (result.error) {
                this.notification.add(_t(result.error), { type: "danger" });
                return;
            }

            this.notification.add(_t("Payment recorded: %s", [result.move_name]), { type: "success" });
            await this.loadStatement();
        } catch (e) {
            console.error("Error making payment:", e);
            this.notification.add(_t("Error processing payment"), { type: "danger" });
        }
    }

    async addAdjustment(type) {
        if (!this.state.customer) return;

        const title = type === "adjustment_add" ? _t("Add to Account") : _t("Remove from Account");
        const amountStr = await makeAwaitable(this.dialog, NumberPopup, {
            title: title,
            subtitle: _t("Enter amount"),
            startingValue: "",
        });

        if (amountStr === undefined) return;
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) return;

        const notesLabel = type === "adjustment_add"
            ? _t("Reason for addition (required)")
            : _t("Reason for removal (required)");
        const notes = await this.promptForNotes(notesLabel, true);

        if (!notes) return;

        try {
            const result = await this.orm.call("res.partner", "create_customer_adjustment", [
                this.state.customer.id,
                type,
                amount,
                notes,
                this.pos.config.id,
            ]);

            if (result.error) {
                this.notification.add(_t(result.error), { type: "danger" });
                return;
            }

            const actionText = type === "adjustment_add" ? _t("added to") : _t("removed from");
            this.notification.add(
                _t("%s %s account", [formatCurrency(amount, this.pos.company.currency_id.id, { trailingZeros: false }), actionText]),
                { type: "success" }
            );
            await this.loadStatement();
        } catch (e) {
            console.error("Error creating adjustment:", e);
            this.notification.add(_t("Error processing adjustment"), { type: "danger" });
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
        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    formatBalance(amount) {
        return formatCurrency(amount, this.pos.company.currency_id.id, { trailingZeros: false });
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
}

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
