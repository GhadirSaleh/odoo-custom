/** @odoo-module **/
console.log("Hi I am pricelist_toggle_button.js");
let buttonInjected = false;
let pricelistBtn = null;

function isOnProductScreen() {
  return document.querySelector(".product-screen") !== null;
}

function updatePricelistVisibility() {
  if (pricelistBtn) {
    pricelistBtn.style.display = isOnProductScreen() ? "flex" : "none";
  }
}

function injectPricelistButton() {
  if (buttonInjected) return;
  const navbar = document.querySelector(".pos-topheader");
  if (!navbar) return;
  if (!window.posmodel) return;

  const pos = window.posmodel;

  const existingToggle = navbar.querySelector(".o_pricelist_toggle");
  if (existingToggle) {
    buttonInjected = true;
    pricelistBtn = existingToggle;
    updatePricelistVisibility();
    return;
  }

  pricelistBtn = document.createElement("button");
  pricelistBtn.className = "btn btn-warning btn-lg lh-lg o_pricelist_toggle";
  pricelistBtn.innerHTML =
    '<i class="fa fa-th-list me-2"></i><span class="pricelist-name">Pricelist</span>';
  pricelistBtn.style.cssText =
    "display: flex; align-items: center; gap: 0.5rem; font-weight: bold;";

  const updateLabel = () => {
    const pricelist = pos.getOrder()?.pricelist_id;
    const nameSpan = pricelistBtn.querySelector(".pricelist-name");
    if (nameSpan) {
      nameSpan.textContent = pricelist ? pricelist.display_name : "Pricelist";
    }
  };

  pricelistBtn.addEventListener("click", async () => {
    const currentPricelist = pos.getOrder()?.pricelist_id;
    const availablePricelists = pos.config.availablePricelists || [];
    if (availablePricelists.length === 0) return;

    let currentIndex = -1;
    if (currentPricelist) {
      currentIndex = availablePricelists.findIndex(
        (p) => p.id === currentPricelist.id,
      );
    }
    const nextIndex = (currentIndex + 1) % availablePricelists.length;
    await pos.selectPricelist(availablePricelists[nextIndex]);
    updateLabel();
  });

  const leftheader = navbar.querySelector(".pos-leftheader");
  const centerheader = navbar.querySelector(".pos-centerheader");
  const rightheader = navbar.querySelector(".pos-rightheader");

  if (centerheader) {
    navbar.insertBefore(pricelistBtn, centerheader);
  } else if (rightheader) {
    navbar.insertBefore(pricelistBtn, rightheader);
  } else {
    navbar.appendChild(pricelistBtn);
  }

  buttonInjected = true;
  updateLabel();
  updatePricelistVisibility();

  const originalSelectPricelist = pos.selectPricelist;
  pos.selectPricelist = async function (pricelist) {
    await originalSelectPricelist.call(this, pricelist);
    updateLabel();
  };

  const observer = new MutationObserver(() => {
    updatePricelistVisibility();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function tryInject() {
  injectPricelistButton();
  if (!buttonInjected) {
    setTimeout(tryInject, 1000);
  }
}

setTimeout(tryInject, 1000);
