/** @odoo-module **/

/**
 * Topbar Buttons & Dropdown Menu Items
 *
 * Pattern: Raw DOM injection (no Owl patch).
 *
 * Adds custom buttons to the POS top navigation bar and items to the
 * hamburger dropdown menu:
 *
 * 1. **Pricelist Cycler** — Cycles through available pricelists on each click.
 *    Shows the current pricelist name as the label. Patches pos.selectPricelist
 *    to update the label after each change.
 *
 * 2. **Quick Cancel** — Deletes the current order immediately without any
 *    confirmation dialog. Faster workflow for clearing orders.
 *
 * 3. **Customer Accounts** — Navigates to the CustomerAccountListScreen for
 *    viewing and managing customer balances.
 *
 * 4. **Currency Rate Setter** — Topbar button with exchange icon; click opens
 *    a popup to update today's exchange rate. Rate is shown inside the popup,
 *    not on the button itself. Triggers a full POS data reload on success.
 *
 * 5. **Print Price Catalog** — Dropdown menu item in the hamburger menu (☰).
 *    Opens a landscape A4 PDF listing all POS products grouped by category
 *    with their prices from the currently active pricelist.
 *
 * 6. **Import Products CSV** — Dropdown menu item in the hamburger menu (☰).
 *    Opens a file picker, reads the CSV, then shows a popup with column
 *    mapping, preview, and import steps.
 *
 * Visibility: Topbar buttons only show on ProductScreen. Dropdown items
 * are always available in the hamburger menu.
 *
 * Gotchas:
 * - Uses polling (setTimeout loop) to wait for the POS navbar and posmodel
 *   to be ready. The `injected` flag prevents duplicate injection.
 * - Direct DOM manipulation is fragile — if Odoo changes the navbar structure,
 *   the selectors (.pos-topheader, .pos-rightheader, etc.) may break.
 * - All user-facing strings are wrapped in _t() for translation support.
 */

import { CsvImportPopup } from "./csv_import_popup";

import { _t } from "@web/core/l10n/translation";
import { makeAwaitable } from "@point_of_sale/app/utils/make_awaitable_dialog";
import { NumberPopup } from "@point_of_sale/app/components/popups/number_popup/number_popup";

(function () {
    let injected = false;
    let pricelistBtn = null;
    let clearBtn = null;
    let accountBtn = null;
    let rateBtn = null;
    let wrapper = null;

    /** Check whether the current screen is the main ProductScreen. */
    function isOnProductScreen() {
        return document.querySelector(".product-screen") !== null;
    }

    /** Toggle topbar button visibility based on current screen. */
    function updateVisibility() {
        const display = isOnProductScreen() ? "flex" : "none";
        if (pricelistBtn) pricelistBtn.style.display = display;
        if (clearBtn) clearBtn.style.display = display;
        if (accountBtn) accountBtn.style.display = display;
        if (rateBtn) rateBtn.style.display = display;
    }

    /** Refresh the pricelist cycler button label from the current order. */
    function updatePricelistLabel() {
        if (!pricelistBtn) return;
        const pos = window.posmodel;
        const pricelist = pos.getOrder()?.pricelist_id;
        const nameSpan = pricelistBtn.querySelector(".pricelist-name");
        if (nameSpan) {
            nameSpan.textContent = pricelist ? pricelist.display_name : _t("Pricelist");
        }
    }

    /** Hide the rate setter button when POS currency matches company currency. */
    function updateRateVisibility() {
        if (!rateBtn) return;
        const pos = window.posmodel;
        if (!pos) return;
        const posCurrency = pos.currency;
        const companyCurrency = pos.company?.currency_id;
        if (!companyCurrency || posCurrency.id === companyCurrency.id) {
            rateBtn.style.display = "none";
            return;
        }
        rateBtn.style.display = "flex";
    }

    /**
     * Inject "Print Price Catalog" menu item into the hamburger dropdown.
     * Opens /report/pdf/pos_ghadir.price_catalog/<pricelist.id> in a new tab.
     */
    function injectPriceCatalogMenuItem() {
        const container = document.querySelector(".pos-burger-menu-items");
        if (!container) return;
        if (container.querySelector(".o_price_catalog_item")) return;
        const item = document.createElement("span");
        item.className = "o-dropdown-item dropdown-item o-navigable o_price_catalog_item";
        item.setAttribute("role", "menuitem");
        item.setAttribute("tabindex", "0");
        item.textContent = _t("Print Price Catalog");
        item.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const pos = window.posmodel;
            const order = pos.getOrder();
            const pricelist = order?.pricelist_id;
            if (!pricelist) return;
            window.open("/report/pdf/pos_ghadir.price_catalog/" + pricelist.id, "_blank");
        });
        container.appendChild(item);
    }

    /**
     * Inject "Import Products CSV" menu item into the hamburger dropdown.
     * Opens a file picker, reads the CSV, then shows the import popup.
     */
    function injectCsvImportMenuItem() {
        const container = document.querySelector(".pos-burger-menu-items");
        if (!container) return;
        if (container.querySelector(".o_csv_import_item")) return;
        const item = document.createElement("span");
        item.className = "o-dropdown-item dropdown-item o-navigable o_csv_import_item";
        item.setAttribute("role", "menuitem");
        item.setAttribute("tabindex", "0");
        item.textContent = _t("Import Products CSV");
        item.addEventListener("click", (ev) => {
            ev.stopPropagation();
            openFilePicker();
        });
        container.appendChild(item);
    }

    /** Create a hidden file input, trigger click, and read the selected CSV. */
    function openFilePicker() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            await readAndOpenPopup(file);
        });
        input.click();
    }

    /**
     * Read the CSV file text, parse headers, and show the CsvImportPopup
     * via the POS dialog service.
     */
    async function readAndOpenPopup(file) {
        try {
            const text = await file.text();
            const lines = text.split("\n").filter(l => l.trim());
            if (lines.length < 2) {
                alert("CSV must have at least a header row and one data row.");
                return;
            }
            const headers = parseCSVLine(lines[0]);
            const dialog = window.posmodel?.dialog;
            if (!dialog) {
                alert("POS dialog service not available.");
                return;
            }
            await new Promise((resolve) => {
                dialog.add(CsvImportPopup, {
                    csvHeaders: headers,
                    csvContent: text,
                    getPayload: () => resolve(),
                });
            });
        } catch (err) {
            alert("Failed to read CSV: " + (err.message || String(err)));
        }
    }

    /**
     * Parse a single CSV line into header tokens, handling double-quoted
     * fields that may contain commas.
     *
     * @param {string} line — Raw CSV line text.
     * @returns {string[]} Trimmed header values.
     */
    function parseCSVLine(line) {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === "," && !inQuotes) {
                result.push(current.trim());
                current = "";
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    }

    /**
     * Main injection — creates topbar buttons (pricelist cycler, clear,
     * accounts, rate setter) and appends them to the navbar. Sets up a
     * MutationObserver to re-run visibility updates and hamburger menu
     * injection whenever the DOM changes.
     *
     * Safe to call multiple times — the `injected` guard prevents
     * duplicates and re-uses existing button references on re-call.
     */
    function injectButtons() {
        if (injected) return;
        const navbar = document.querySelector(".pos-topheader");
        if (!navbar) return;
        if (!window.posmodel) return;

        if (navbar.querySelector(".o_topbar_buttons_wrapper")) {
            injected = true;
            pricelistBtn = navbar.querySelector(".o_pricelist_toggle");
            clearBtn = navbar.querySelector(".o_clear_cart_btn");
            accountBtn = navbar.querySelector(".o_customer_account_btn");
            rateBtn = navbar.querySelector(".o_currency_rate_btn");
            updateVisibility();
            return;
        }

        const pos = window.posmodel;

        wrapper = document.createElement("div");
        wrapper.className = "o_topbar_buttons_wrapper d-flex gap-2 align-items-center";
        wrapper.style.cssText = "display: flex !important;";

        pricelistBtn = document.createElement("button");
        pricelistBtn.className = "btn btn-info btn-lg lh-lg o_pricelist_toggle";
        pricelistBtn.innerHTML = '<i class="fa fa-th-list me-2"></i><span class="pricelist-name">' + _t("Pricelist") + '</span>';
        pricelistBtn.style.cssText = "display: flex; align-items: center; gap: 0.5rem; font-weight: bold; min-width: 0; overflow: hidden; max-width: 200px; flex-shrink: 1;";

        pricelistBtn.addEventListener("click", async () => {
            const currentPricelist = pos.getOrder()?.pricelist_id;
            const availablePricelists = pos.config.availablePricelists || [];
            if (availablePricelists.length === 0) return;
            let currentIndex = -1;
            if (currentPricelist) {
                currentIndex = availablePricelists.findIndex((p) => p.id === currentPricelist.id);
            }
            const nextIndex = (currentIndex + 1) % availablePricelists.length;
            await pos.selectPricelist(availablePricelists[nextIndex]);
            updatePricelistLabel();
        });

        clearBtn = document.createElement("button");
        clearBtn.className = "btn btn-danger btn-lg lh-lg o_clear_cart_btn";
        clearBtn.innerHTML = '<i class="fa fa-trash-o me-1"></i><span>' + _t("Clear") + '</span>';
        clearBtn.style.cssText = "display: flex !important; align-items: center; gap: 0.3rem;";
        clearBtn.title = _t("Cancel entire order without confirmation");

        clearBtn.addEventListener("click", async () => {
            const order = pos.getOrder();
            if (!order) return;
            await pos.deleteOrders([order]);
        });

        accountBtn = document.createElement("button");
        accountBtn.className = "btn btn-secondary btn-lg lh-lg o_customer_account_btn";
        accountBtn.innerHTML = '<i class="fa fa-users me-1"></i><span>' + _t("Accounts") + '</span>';
        accountBtn.style.cssText = "display: flex !important; align-items: center; gap: 0.3rem;";
        accountBtn.title = _t("Customer Accounts");

        accountBtn.addEventListener("click", () => {
            pos.navigate("CustomerAccountListScreen");
        });

        wrapper.appendChild(pricelistBtn);
        wrapper.appendChild(clearBtn);
        wrapper.appendChild(accountBtn);

        rateBtn = document.createElement("button");
        rateBtn.className = "btn btn-success btn-lg lh-lg o_currency_rate_btn";
        rateBtn.innerHTML = '<i class="fa fa-exchange"></i>';
        rateBtn.style.cssText = "display: flex !important; align-items: center; gap: 0.3rem;";
        rateBtn.title = _t("Set currency exchange rate");

        rateBtn.addEventListener("click", async () => {
            const posCurrency = pos.currency;
            const companyCurrency = pos.company?.currency_id;
            if (!companyCurrency || posCurrency.id === companyCurrency.id) return;

            const inverseRate = pos.models._currencyRates?.[posCurrency.id];
            const currentRate = inverseRate ? Math.round(1 / inverseRate) : 0;

            const newRate = await makeAwaitable(pos.dialog, NumberPopup, {
                title: _t("Set Exchange Rate"),
                startingValue: currentRate || 0,
                subtitle: _t("1 %s = %s %s", companyCurrency.name, Math.round(currentRate).toLocaleString(), posCurrency.name),
            });

            if (!newRate || parseFloat(newRate) <= 0) return;

            try {
                const result = await pos.data.call(
                    "res.currency",
                    "set_currency_rate_from_pos",
                    [posCurrency.id, parseFloat(newRate)],
                );
                if (result?.success) {
                    await pos.reloadData(true);
                }
            } catch (e) {
                console.error("Error setting currency rate:", e);
            }
        });

        wrapper.appendChild(rateBtn);

        const rightheader = navbar.querySelector(".pos-rightheader");
        const centerheader = navbar.querySelector(".pos-centerheader");

        if (rightheader) {
            navbar.insertBefore(wrapper, rightheader);
        } else if (centerheader) {
            navbar.insertBefore(wrapper, centerheader);
        } else {
            navbar.appendChild(wrapper);
        }

        injected = true;
        updatePricelistLabel();
        updateVisibility();
        updateRateVisibility();

        const originalSelectPricelist = pos.selectPricelist;
        pos.selectPricelist = async function (pricelist) {
            await originalSelectPricelist.call(this, pricelist);
            updatePricelistLabel();
        };

        const observer = new MutationObserver(() => {
            updateVisibility();
            injectPriceCatalogMenuItem();
            injectCsvImportMenuItem();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Poll for the POS navbar and posmodel, then inject buttons.
     * Re-checks every 500ms until injection succeeds.
     */
    function tryInject() {
        injectButtons();
        if (!injected) {
            setTimeout(tryInject, 500);
        }
    }

    setTimeout(tryInject, 800);
})();
