/** @odoo-module **/

/**
 * Topbar Buttons & Dropdown Menu Items
 * ======================================
 * Pattern: Raw DOM injection (no Owl patch)
 *
 * Adds custom buttons to the POS top navigation bar and items to the
 * hamburger dropdown menu:
 *
 * 1. Pricelist Cycler — Cycles through available pricelists on each click.
 *    Shows the current pricelist name as the label. Patches pos.selectPricelist
 *    to update the label after each change.
 *
 * 2. Quick Cancel — Deletes the current order immediately without any
 *    confirmation dialog. Faster workflow for clearing orders.
 *
 * 3. Customer Accounts — Navigates to the CustomerAccountListScreen for
 *    viewing and managing customer balances.
 *
 * 4. Currency Rate Setter — Topbar button with exchange icon; click opens
 *    a popup to update today's exchange rate. Rate is shown inside the popup,
 *    not on the button itself. Triggers a full POS data reload on success.
 *
 * 5. Print Price Catalog — Dropdown menu item in the hamburger menu (☰).
 *    Opens a landscape A4 PDF listing all POS products grouped by category
 *    with their prices from the currently active pricelist.
 *
 * Visibility: Topbar buttons only show on ProductScreen. The dropdown item
 * is always available in the hamburger menu.
 *
 * Gotchas:
 * - Uses polling (setTimeout loop) to wait for the POS navbar and posmodel
 *   to be ready. The `injected` flag prevents duplicate injection.
 * - Direct DOM manipulation is fragile — if Odoo changes the navbar structure,
 *   the selectors (.pos-topheader, .pos-rightheader, etc.) may break.
 * - All user-facing strings are wrapped in _t() for translation support.
 */

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

    function isOnProductScreen() {
        return document.querySelector(".product-screen") !== null;
    }

    function updateVisibility() {
        const display = isOnProductScreen() ? "flex" : "none";
        if (pricelistBtn) pricelistBtn.style.display = display;
        if (clearBtn) clearBtn.style.display = display;
        if (accountBtn) accountBtn.style.display = display;
        if (rateBtn) rateBtn.style.display = display;
    }

    function updatePricelistLabel() {
        if (!pricelistBtn) return;
        const pos = window.posmodel;
        const pricelist = pos.getOrder()?.pricelist_id;
        const nameSpan = pricelistBtn.querySelector(".pricelist-name");
        if (nameSpan) {
            nameSpan.textContent = pricelist ? pricelist.display_name : _t("Pricelist");
        }
    }

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

    function injectButtons() {
        if (injected) return;
        const navbar = document.querySelector(".pos-topheader");
        if (!navbar) return;
        if (!window.posmodel) return;

        // Safety: if already injected by a previous call, grab references and return
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

        // --- Pricelist Cycler Button ---
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

        // --- Quick Cancel Button ---
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

        // --- Customer Accounts Button ---
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

        // --- Currency Rate Setter Button ---
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

        // Insert into navbar at the right position
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

        // Patch selectPricelist to update the button label after pricelist changes
        const originalSelectPricelist = pos.selectPricelist;
        pos.selectPricelist = async function (pricelist) {
            await originalSelectPricelist.call(this, pricelist);
            updatePricelistLabel();
        };

        // Watch for DOM changes to toggle button visibility on screen navigation
        const observer = new MutationObserver(() => {
            updateVisibility();
            injectPriceCatalogMenuItem();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function tryInject() {
        injectButtons();
        if (!injected) {
            setTimeout(tryInject, 500);
        }
    }

    setTimeout(tryInject, 800);
})();
