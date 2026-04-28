/** @odoo-module **/

let buttonInjected = false;

function injectClearCartButton() {
    if (buttonInjected) return;

    const navbar = document.querySelector(".pos-topheader");
    if (!navbar) return;
    if (!window.posmodel) return;

    const pos = window.posmodel;

    const existingButton = navbar.querySelector(".o_clear_cart_btn");
    if (existingButton) {
        buttonInjected = true;
        return;
    }

    const btn = document.createElement("button");
    btn.className = "btn btn-danger btn-lg lh-lg o_clear_cart_btn";
    btn.innerHTML = '<i class="fa fa-trash-o me-1"></i><span>Clear</span>';
    btn.style.cssText = "display: flex !important; align-items: center; gap: 0.3rem;";
    btn.title = "Cancel entire order without confirmation";

    btn.addEventListener("click", async () => {
        const order = pos.getOrder();
        if (!order) return;

        // Cancel the entire order without confirmation (like default Cancel Order but no popup)
        await pos.deleteOrders([order]);
    });

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
}

function tryInject() {
    injectClearCartButton();
    if (!buttonInjected) {
        setTimeout(tryInject, 1000);
    }
}

setTimeout(tryInject, 1500);