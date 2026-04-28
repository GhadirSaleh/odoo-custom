/** @odoo-module **/
console.log("Hi I am clear_cart_button.js");

let buttonInjected = false;

function injectClearCartButton() {
  if (buttonInjected) return;

  console.log("Trying to inject clear cart button...");

  const navbar = document.querySelector(".pos-topheader");
  if (!navbar) {
    console.log("Navbar not found!");
    return;
  }
  if (!window.posmodel) {
    console.log("posmodel not available yet");
    return;
  }

  const pos = window.posmodel;
  console.log("posmodel found:", !!pos);

  const existingButton = navbar.querySelector(".o_clear_cart_btn");
  if (existingButton) {
    console.log("Button already exists, marking as injected");
    buttonInjected = true;
    return;
  }

  const btn = document.createElement("button");
  btn.className = "btn btn-danger btn-lg lh-lg o_clear_cart_btn";
  btn.innerHTML = '<i class="fa fa-trash-o me-1"></i><span>Clear</span>';
  btn.style.cssText =
    "display: flex !important; align-items: center; gap: 0.3rem;";
  btn.title = "Clear all products from cart";

  btn.addEventListener("click", () => {
    console.log("Clear cart clicked!");
    const order = pos.getOrder();
    if (!order) {
      console.log("No order found");
      return;
    }

    const lines = order.getOrderlines();
    console.log("Found lines to clear:", lines.length);
    for (let i = lines.length - 1; i >= 0; i--) {
      order.removeOrderline(lines[i]);
    }
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
  console.log("Clear cart button injected successfully!");
}

function tryInject() {
  injectClearCartButton();
  if (!buttonInjected) {
    setTimeout(tryInject, 1000);
  }
}

setTimeout(tryInject, 1500);
