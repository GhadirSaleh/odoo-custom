/** @odoo-module **/

let buttonInjected = false;
let clearCartBtn = null;

function isOnProductScreen() {
    return document.querySelector(".product-screen") !== null;
}

function updateClearCartVisibility() {
    if (clearCartBtn) {
        clearCartBtn.style.display = isOnProductScreen() ? "flex" : "none";
    }
}

function injectClearCartButton() {
    if (buttonInjected) return;

    const navbar = document.querySelector(".pos-topheader");
    if (!navbar) return;
    if (!window.posmodel) return;

    const pos = window.posmodel;

    const existingButton = navbar.querySelector(".o_clear_cart_btn");
    if (existingButton) {
        buttonInjected = true;
        clearCartBtn = existingButton;
        updateClearCartVisibility();
        return;
    }

    clearCartBtn = document.createElement("button");
    clearCartBtn.className = "btn btn-danger btn-lg lh-lg o_clear_cart_btn";
    clearCartBtn.innerHTML = '<i class="fa fa-trash-o me-1"></i><span>Clear</span>';
    clearCartBtn.style.cssText = "display: flex !important; align-items: center; gap: 0.3rem;";
    clearCartBtn.title = "Cancel entire order without confirmation";

    clearCartBtn.addEventListener("click", async () => {
        const order = pos.getOrder();
        if (!order) return;

        // Cancel the entire order without confirmation (like default Cancel Order but no popup)
        await pos.deleteOrders([order]);
    });

    const centerheader = navbar.querySelector(".pos-centerheader");
    const rightheader = navbar.querySelector(".pos-rightheader");

    if (centerheader) {
        navbar.insertBefore(clearCartBtn, centerheader);
    } else if (rightheader) {
        navbar.insertBefore(clearCartBtn, rightheader);
    } else {
        navbar.appendChild(clearCartBtn);
    }

    buttonInjected = true;
    updateClearCartVisibility();

    const observer = new MutationObserver(() => {
        updateClearCartVisibility();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function tryInject() {
    injectClearCartButton();
    if (!buttonInjected) {
        setTimeout(tryInject, 1000);
    }
}

setTimeout(tryInject, 1500);