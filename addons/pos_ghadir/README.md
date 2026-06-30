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
- **Settle Balance** — One-tap "تسوية الرصيد" to bring a customer's balance
  to zero. If the customer owes, creates a payment; if they have credit,
  creates an adjustment. Shows a color-coded confirmation dialog with
  current balance, settlement amount, and resulting zero balance.
- **Withdraw / Adjust** — Increase a customer's balance (e.g. for new
  purchases on credit) with mandatory audit notes.

### Multi-Currency

- Live exchange rates fetched on POS startup.
- **Quick Rate Setter** — Topbar button showing `Rate: 13,000`. Tap to
  update today's SYP/USD rate from the register. Sets the backend
  `res.currency.rate` record and triggers a full POS reload.
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
- Config name footer — POS register name displayed as centered bold text at
  the bottom of each receipt.
- Payment line amounts use `formattedAmount` getter (no trailing zeros).

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

### Pricelist Rounding

- **Rounding Threshold** — Per-pricelist percentage field replacing the old
  boolean round-up toggle. Controls the cutoff between rounding down and
  rounding up (0–100%). Example: threshold 30% with precision 100 means
  129→100, 130→100, 131→200.
- **Applies globally**: sale orders, invoices, POS, ecommerce, pricelist
  reports — anywhere a pricelist price is computed.
- **Pricelist-level setting**: each pricelist has its own threshold, so you
  can mix rounding strategies (e.g. 30% for retail, 50% for wholesale).
- **Synced to POS**: the threshold is loaded into the POS session so rounding
  behavior is consistent between backend and frontend.

### Stock Alerts

- **Color-coded badges** on product cards showing real-time stock levels.
- **Three states**: green (ok), amber (low), red (out of stock).
- **Configurable threshold** — set "low stock" quantity per POS config.
- **Post-order refresh** — stock updates immediately after each sale.
- **Batch fetch at startup** — all product stock loaded in one shot on session open.
- **Toggle on/off** — enable/disable via POS settings → Show Stock Alerts.
- **Storable only** — badges only appear for products with `is_storable` enabled (not consumables/services).

### CSV Product Import

- **Hamburger menu entry** — ☰ → **Import Products CSV** opens a file picker.
- **Column mapping wizard** — Each CSV header listed with a dropdown to pick
  the target Odoo field. Auto-detection (longest-pattern algorithm) pre-selects
  most columns based on common names and Arabic equivalents.
- **Dynamic field options** — All Odoo product fields are fetched live from the
  model (via `fields_get()`), so custom fields appear automatically. Binary,
  one2many, many2many, and internal fields are excluded.
- **Virtual fields** — `reorder_min`/`reorder_max` (creates `stock.warehouse.orderpoint`),
  `seller_id` (creates supplier info), `pos_categ_ids` (assigns POS categories by
  comma-separated names).
- **Preview step** — Dry-run validation per row (Create/Update action, error count).
  Errors have tooltips with details (missing name, invalid number, unknown vendor, etc.).
- **Blank-cell clearing** — Empty CSV cells write type-appropriate empty values
  (0, `False`, `''`) so fields get zeroed/cleared, not left stale.
- **Upsert by SKU then name** — If `default_code` matches an existing variant,
  it updates; otherwise falls back to exact name match on variant then template.
- **POS reload on Close** — After import, the Close button runs `reloadData(true)`,
  matching the exchange rate setter pattern.
- **Full Arabic translation** — All 30+ UI strings are translated in `i18n/ar_001.po`.

### Additional

- **Price Catalog PDF** — Hamburger menu (☰) → **Print Price Catalog**.
  Generates a landscape A4 PDF listing all POS products grouped by category,
  with prices from the currently active pricelist. Uses a compact 4-column
  layout with gridlines and alternating row colors (no currency symbol).
  Prices are computed using the pricelist's rounding threshold.
- **Quick Rate Setter** — Exchange icon button in the topbar. Click to open
  a popup showing the current rate (e.g. "1 USD = 13,000 SYP") and update
  today's exchange rate. Triggers a full POS data reload.
- **Hide Chatter** — The Odoo chatter (message/activity stream) is hidden
  globally on backend forms via `hide_chatter.scss`, because this POS does
  not use internal chatter for customer communication.

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

One field is added to the pricelist form (Sales → Products → Pricelists → open a pricelist):

| Field | Description | Default |
| --- | --- | --- |
| `rounding_threshold` | Fractional threshold for rounding (0.00 = always down, 0.50 ≈ HALF-UP, 1.00 = always up). If the fractional part exceeds this value, the price rounds up. | 0.50 |

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
| Settle balance | Customer Accounts → select customer → **تسوية الرصيد** → confirm settlement |
| Cycle pricelists | Click pricelist name in navbar |
| Set exchange rate | Tap **Rate** in topbar → enter new value → confirm |
| Quick cancel | Click Clear in navbar |
| Configure rounding threshold | Sales → Products → Pricelists → open pricelist → set **Rounding Threshold** |
| Configure stock alerts | PoS → Settings → Show Stock Alerts + Low Stock Threshold |
| Prerequisite: stock mode | Settings → Companies → Update Stock Quantities → In real time |
| Check stock badge | Look at the top-left corner of each product card |
| Import products from CSV | ☰ → **Import Products CSV** → pick `.csv` file → map columns → Preview → Import → Reload Data |

## File Map

```text
pos_ghadir/
├── __init__.py
├── __manifest__.py
├── README.md
├── controllers/
│   ├── __init__.py
│   └── product_import.py         # CSV import controller: field detection, preview, upsert, orderpoints
├── i18n/
│   └── ar_001.po                 # Arabic translations (30+ for CSV import)
├── models/
│   ├── __init__.py
│   ├── pos_order.py              # Balance snapshot fields + perf logging
│   ├── pos_config.py             # Stock alert config fields
│   ├── product_pricelist.py      # rounding_threshold field + POS data sync
│   ├── product_pricelist_item.py # Custom rounding with configurable threshold
│   ├── product_product.py        # Stock RPC method + POS field list
│   ├── product_template.py       # qty_available in POS field list
│   ├── res_currency.py           # RPC: set_currency_rate_from_pos (quick rate setter)
│   └── res_partner.py            # RPC: customer accounts, payments, adjustments
├── views/
│   ├── pos_config_view.xml       # Stock alerts settings in POS config form
│   └── product_pricelist_view.xml  # Rounding Threshold percent_pie widget
└── static/
    └── src/
        ├── js/
        │   ├── account_utils.js           # Shared account helpers + showPaymentReceipt
        │   ├── auto_enable_invoice.js
        │   ├── clean_currency_format.js
        │   ├── currency_utils.js           # formatAmountAfterSymbol (shared currency formatting)
        │   ├── csv_import_popup.js        # 3-step wizard: mapping, preview, import
        │   ├── customer_account_screens.js  # NotesPopup, CustomerAccountListScreen, StatementScreen
        │   ├── default_qty_two.js
        │   ├── deselect_on_background_click.js
        │   ├── disable_auto_invoice_download.js
        │   ├── disable_price_button.js
        │   ├── dual_currency_display.js
        │   ├── note_button_fix.js
        │   ├── partner_balance_fetcher.js
        │   ├── pricelist_rounding.js       # Patches getPrice with rounding threshold
        │   ├── partner_balance_snapshot.js
        │   ├── partner_due_currency_convert.js
        │   ├── payment_receipt.js
        │   ├── payment_receipt_popup.js
        │   ├── prevent_empty_payment_line.js
        │   ├── stock_alerts.js            # ProductCard badge + batch RPC + post-order refresh
        │   └── topbar_buttons.js          # Topbar buttons + hamburger menu items + CSV import entry
        ├── scss/
        │   ├── customer_account_screens.scss
        │   ├── hide_chatter.scss
        │   ├── pos_custom.scss
        │   └── stock_alerts.scss          # Subtle stock badge styles
        └── xml/
            ├── csv_import_popup.xml       # 3-step wizard template (_t-wrapped strings)
            ├── customer_account_screens.xml
            ├── dual_currency_display.xml
            ├── payment_receipt.xml        # Payment/withdrawal receipt layout
            ├── receipt_partner_balance.xml
            └── stock_alerts.xml           # Badge injection into ProductCard template
```
