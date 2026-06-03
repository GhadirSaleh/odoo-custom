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
- **Withdraw / Adjust** — Increase balances for credit purchases with
  mandatory audit notes.
- **Live Balance Display** — Customer balance shown on the selection
  button, color-coded (red = owes, green = credit).
- **Balance Snapshots** — Historic balance stored at order creation
  time; reprinted receipts always show the original figures.

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

## Dependencies

- `point_of_sale`
- `account`
- `sale`
- `purchase`

## Installation

The module has `auto_install: True`, so it activates automatically
when all dependencies are present. To install manually:

```
docker compose exec odoo odoo -c /etc/odoo/odoo.conf \
  --db_host=db --db_user=odoo --db_password=odoo \
  -d odoo -u pos_ghadir --stop-after-init --workers=0 --http-port=8067
```

## Usage

| Action | Steps |
|---|---|
| View accounts | ☰ → Customer Accounts |
| Check balance | Select a customer |
| Make payment | Customer Accounts → select → Make Payment → choose currency → enter amount → confirm |
| Withdraw/adjust | Customer Accounts → select → Withdraw → enter amount → add notes → confirm |
| Cycle pricelists | Click pricelist name in navbar |
| Quick cancel | Click Clear in navbar |

## File Map

```
pos_ghadir/
├── __init__.py
├── __manifest__.py
├── README.md
├── i18n/
│   └── ar_001.po              # Arabic translations
├── models/
│   ├── __init__.py
│   ├── pos_order.py            # Balance snapshot fields + perf logging
│   └── res_partner.py          # RPC: customer accounts, payments, adjustments
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
        │   └── topbar_buttons.js
        ├── scss/
        │   ├── customer_account_screens.scss
        │   ├── hide_chatter.scss
        │   └── pos_custom.scss
        └── xml/
            ├── customer_account_screens.xml
            ├── dual_currency_display.xml
            ├── payment_receipt.xml
            └── receipt_partner_balance.xml
```
