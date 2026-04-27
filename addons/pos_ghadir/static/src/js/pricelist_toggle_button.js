/** @odoo-module **/

let buttonInjected = false;

function injectPricelistButton() {
    if (buttonInjected) return;
    const navbar = document.querySelector(".pos-topheader");
    if (!navbar) return;
    if (!window.posmodel) return;

    const existingToggle = navbar.querySelector(".o_pricelist_toggle");
    if (existingToggle) {
        buttonInjected = true;
        return;
    }

    const pos = window.posmodel;
    const btn = document.createElement("button");
    btn.className = "btn btn-warning btn-lg lh-lg o_pricelist_toggle";
    btn.innerHTML = '<i class="fa fa-th-list me-2"></i><span class="pricelist-name">Pricelist</span>';
    btn.style.cssText = "display: flex; align-items: center; gap: 0.5rem; font-weight: bold;";

    const updateLabel = () => {
        const pricelist = pos.getOrder()?.pricelist_id;
        const nameSpan = btn.querySelector(".pricelist-name");
        if (nameSpan) {
            nameSpan.textContent = pricelist ? pricelist.display_name : "Pricelist";
        }
    };

    btn.addEventListener("click", async () => {
        const currentPricelist = pos.getOrder()?.pricelist_id;
        const availablePricelists = pos.config.availablePricelists || [];
        if (availablePricelists.length === 0) return;

        let currentIndex = -1;
        if (currentPricelist) {
            currentIndex = availablePricelists.findIndex(p => p.id === currentPricelist.id);
        }
        const nextIndex = (currentIndex + 1) % availablePricelists.length;
        await pos.selectPricelist(availablePricelists[nextIndex]);
        updateLabel();
    });

    const leftheader = navbar.querySelector(".pos-leftheader");
    const centerheader = navbar.querySelector(".pos-centerheader");
    const rightheader = navbar.querySelector(".pos-rightheader");

    if (centerheader) {
        navbar.insertBefore(btn, centerheader);
    } else if (rightheader) {
        navbar.insertBefore(btn, rightheader);
    } else {
        navbar.appendChild(btn);
    }

    buttonInjected = true;
    updateLabel();

    const originalSelectPricelist = pos.selectPricelist;
    pos.selectPricelist = async function(pricelist) {
        await originalSelectPricelist.call(this, pricelist);
        updateLabel();
    };
}

function tryInject() {
    injectPricelistButton();
    if (!buttonInjected) {
        setTimeout(tryInject, 1000);
    }
}

setTimeout(tryInject, 1000);