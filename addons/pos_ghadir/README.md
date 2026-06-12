# Ghadir POS — Customer Accounts, Multi-Currency & Workflow

A comprehensive Odoo 19 POS extension for retail operations requiring
real-time customer account management and multi-currency support.

## Features

### Customer Account Management

- **Dedicated POS Screen** — Browse all customers with live balances
  from the hamburger menu.
- **Account Statements** — Per-customer journal with running balance,
  document references, and full transaction history.
- **Make Payment** — Accept customer payments at the POS, creating
  proper accounting entries (Dr. POS journal / Cr. Accounts Receivable).

### Multi-Currency

- Live exchange rates fetched on POS startup.
- Order total converted to company currency on screen and receipt.
- Partner due (balance + order) converted for remaining-balance display.
- Currency selection in payment/withdrawal flows.

### Receipt

- Previous balance (حساب سابق) below customer info.
- Remaining balance (باقي الحساب) after the order footer.
- Dual-currency equivalent total.
- Custom header (ticket left / date right).
- Clean typography: no taxes, change, or contact noise.
- Dedicated payment/withdrawal receipt layout.

### Workflow Optimizations

- Pricelist cycler in the navbar.
- Quick one-click order cancellation.
- Default product quantity of 2.
- Invoice auto-enabled by default.
- No automatic PDF download.
- Prices without trailing zeros.
- Price override disabled.
- Deselect order line on background click.
- Empty payment prevention.
- Note-button bug fix (Odoo 19 core).

### Stock Alerts

- **Color-coded badges** on product cards showing real-time stock levels.
- **Three states**: green (ok), amber (low), red (out of stock).
- **Configurable threshold** — set "low stock" quantity per POS config.
- **Post-order refresh** — stock updates immediately after each sale.
- **Batch fetch at startup** — all product stock loaded in one shot on session open.
- **Toggle on/off** — enable/disable via POS settings → Show Stock Alerts.
- **Storable only** — badges only appear for products with `is_storable` enabled (not consumables/services).

### Prerequisites

- **Stock update mode** must be set to **"In real time"** (`point_of_sale_update_stock_quantities = 'real'`)
  in the company settings. Without this, stock is not decremented on POS orders and badges
  will not reflect actual availability.

### Configuration

Two fields are added to the POS configuration form (PoS → Settings → Point of Sale):

| Field | Description | Default |
| --- | --- | --- |
| `pos_show_stock_alerts` | Enable/disable stock badges on product cards | True |
| `pos_low_stock_threshold` | Quantity below which a product is considered "low stock" | 5.0 |

## Dependencies

- `point_of_sale`
- `account`
- `sale`
- `purchase`
- `stock`

## Installation

The module has `auto_install: True`, so it activates automatically
when all dependencies are present. To install manually:

```bash
docker compose exec odoo odoo -c /etc/odoo/odoo.conf \
  --db_host=db --db_user=odoo --db_password=odoo \
  -d odoo -u pos_ghadir --stop-after-init --workers=0 --http-port=8067
```

## Usage

| Action | Steps |
| --- | --- |
| View accounts | ☰ → Customer Accounts |
| Check balance | Select a customer |
| Make payment | Customer Accounts → select → Make Payment → choose currency → enter amount → confirm |
| Withdraw/adjust | Customer Accounts → select → Withdraw → enter amount → add notes → confirm |
| Cycle pricelists | Click pricelist name in navbar |
| Quick cancel | Click Clear in navbar |
| Configure stock alerts | PoS → Settings → Show Stock Alerts + Low Stock Threshold |
| Prerequisite: stock mode | Settings → Companies → Update Stock Quantities → In real time |
| Check stock badge | Look at the top-left corner of each product card |

## File Map

```text
pos_ghadir/
├── __init__.py
├── __manifest__.py
├── README.md
├── i18n/
│   └── ar_001.po              # Arabic translations
├── models/
│   ├── __init__.py
│   ├── pos_order.py            # Balance snapshot fields + perf logging
│   ├── pos_config.py           # Stock alert config fields
│   ├── product_product.py      # Stock RPC method + POS field list
│   ├── product_template.py     # qty_available in POS field list
│   └── res_partner.py          # RPC: customer accounts, payments, adjustments
├── views/
│   └── pos_config_view.xml     # Stock alerts settings in POS config form
└── static/
    └── src/
        ├── js/
        │   ├── auto_enable_invoice.js
        │   ├── clean_currency_format.js
        │   ├── customer_account_screens.js   # NotesPopup, CustomerAccountListScreen, StatementScreen
        │   ├── default_qty_two.js
        │   ├── deselect_on_background_click.js
        │   ├── disable_auto_invoice_download.js
        │   ├── disable_price_button.js
        │   ├── dual_currency_display.js
        │   ├── note_button_fix.js
        │   ├── partner_balance_fetcher.js
        │   ├── partner_balance_snapshot.js
        │   ├── partner_due_currency_convert.js
        │   ├── payment_receipt.js
        │   ├── payment_receipt_popup.js
        │   ├── prevent_empty_payment_line.js
        │   ├── stock_alerts.js          # ProductCard badge + batch RPC + post-order refresh
        │   └── topbar_buttons.js
        ├── scss/
        │   ├── customer_account_screens.scss
        │   ├── hide_chatter.scss
        │   ├── pos_custom.scss
        │   └── stock_alerts.scss        # Subtle stock badge styles
        └── xml/
            ├── customer_account_screens.xml
            ├── dual_currency_display.xml
            ├── payment_receipt.xml
            ├── receipt_partner_balance.xml
            └── stock_alerts.xml         # Badge injection into ProductCard template
```
