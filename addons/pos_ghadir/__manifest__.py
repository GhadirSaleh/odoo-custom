{
    'name': 'Ghadir POS — Customer Accounts, Multi-Currency & Workflow',
    'version': '1.0',
    'category': 'Point of Sale',
    'author': 'Cybrosys Techno Solutions + Ghadir Customizations',
    'summary': 'Customer account management, multi-currency conversion, stock alerts, receipt enhancements, and workflow optimizations for Odoo POS',
    'description': """
Ghadir POS — Full-Featured POS Extension for Odoo 19
======================================================

A comprehensive Point of Sale extension that transforms Odoo's standard POS
into a complete retail management system with real-time customer accounting,
multi-currency support, and streamlined cashier workflows.

**Why this module?**

Standard Odoo POS lacks built-in customer account management — cashiers
cannot view balances, make payments, or handle multi-currency at the POS.
This module fills those gaps while improving everyday usability for
cashiers and customers alike.

Core Features
=============

Customer Account Management (POS-native)
-----------------------------------------
* **Customer Accounts Screen** — Dedicated POS screen from the hamburger menu
  showing all customers with real-time credit/debit balances.
* **Account Statement View** — Per-customer accounting history with running
  balance, date, document reference, debit, and credit columns.
* **Make Payment** — Accept payments from customers to reduce their
  outstanding balance, creating proper journal entries (debit POS journal,
  credit Accounts Receivable).
* **Withdraw / Adjust** — Increase a customer's balance (e.g. for new
  purchases on credit) with mandatory audit notes.
* **Partner Balance Display** — Live customer balance shown on the customer
  selection button, color-coded (red = owes, green = credit, muted = zero).
* **Balance Snapshots** — Backend-stored balance at order creation time,
  so reprinted receipts always show historic balances, not live ones.

Multi-Currency Support
----------------------
* **Live Currency Rates** — Fetches exchange rates from the company's rate
  list on POS startup.
* **Converted Total Display** — Shows the order total in the company's base
  currency alongside the POS currency on both the order screen and receipt.
* **Partner Due Conversion** — Combines the customer's previous balance with
  the current order total and converts the result to company currency for
  the "باقي الحساب" (remaining balance) line on receipts.
* **Multi-Currency Payments** — Payment and withdrawal flows let the cashier
  choose the transaction currency.

Receipt Enhancements
--------------------
* **Previous Balance (حساب سابق)** — Shows the customer's outstanding balance
  at the top of the receipt, below customer info.
* **Remaining Balance (باقي الحساب)** — Shows the projected balance after
  this order at the bottom of the receipt.
* **Dual-Currency Total** — Displays the order equivalent in the company's
  base currency.
* **Custom Receipt Layout** — Ticket number on the left, date on the right;
  cleaner typography; thick borders for totals; no taxes/change/contact noise.
* **Payment Receipt** — Dedicated receipt layout for payment and withdrawal
  transactions with full customer details, transaction type, amounts, notes,
  and new balance.

Stock Alerts
------------
* **Color-coded stock badges** — Real-time stock levels on product cards (green=ok, amber=low, red=out).
* **Configurable threshold** — Set low-stock warning level per POS config.
* **Post-order refresh** — Stock updates immediately via RPC after each sale validation.
* **Batch fetch at startup** — All product stock loaded in one shot when the POS session opens.
* **Toggle on/off** — Enable or disable from POS settings.

Cashier Workflow Optimizations
------------------------------
* **Pricelist Cycler** — Topbar button to cycle through available pricelists
  without going into settings.
* **Quick Cancel** — One-click order cancellation without confirmation dialog.
* **Default Quantity of 2** — Products added with qty 2 instead of 1.
* **Auto-Enable Invoice** — Invoice toggle is ON by default for every order.
* **No Auto PDF Download** — Prevents the browser from downloading invoice
  PDFs automatically after validation.
* **Clean Currency Format** — Prices displayed without trailing zeros
  (e.g. "1,500 $" instead of "1,500.00 $").
* **Disable Price Override** — Cashiers cannot manually change product prices.
* **Deselect on Background Click** — Clicking empty space clears the selected
  order line (more intuitive touch behavior).
* **Prevent Empty Payment** — A toast warns the cashier when trying to add
  a payment line for an already-paid order.
* **Note Button Fix** — Fixes an Odoo 19 core bug where adding a note to a
  partial quantity of an orderline crashed if the selection changed while
  the note dialog was open.

Technical Details
=================
* **Odoo Version**: 19.0
* **Dependencies**: point_of_sale, account, sale, purchase, stock
* **License**: AGPL-3
* **Auto Install**: Yes — activates automatically when its dependencies are present.

Usage Guide
===========
1. **View customer accounts**: Hamburger menu (☰) → Customer Accounts
2. **Check customer balance**: Select a customer — their balance appears
   next to their name in the customer button.
3. **Make a payment**: Customer Accounts → select customer → Make Payment →
   choose currency → enter amount → confirm.
4. **Withdraw / adjust**: Customer Accounts → select customer → Withdraw →
   enter amount → add notes → confirm.
5. **Cycle pricelists**: Click the pricelist name in the top navbar.
6. **Quick cancel**: Click the Clear button in the top navbar.
7. **Configure stock alerts**: PoS → Settings → enable "Show Stock Alerts" + set "Low Stock Threshold".
8. **Check stock badge**: Look at the top-left corner of any product card.
    """,
    'data': [
        'views/pos_config_view.xml',
        'views/product_pricelist_view.xml',
    ],
    'depends': ['point_of_sale', 'account', 'sale', 'purchase', 'stock'],
    'assets': {
        'web.assets_backend': [
            'pos_ghadir/static/src/scss/hide_chatter.scss',
        ],
        'point_of_sale._assets_pos': [
            'pos_ghadir/static/src/scss/pos_custom.scss',
            'pos_ghadir/static/src/scss/stock_alerts.scss',
            'pos_ghadir/static/src/scss/customer_account_screens.scss',
            'pos_ghadir/static/src/js/disable_price_button.js',
            'pos_ghadir/static/src/js/topbar_buttons.js',
            'pos_ghadir/static/src/js/default_qty_two.js',
            'pos_ghadir/static/src/js/clean_currency_format.js',
            'pos_ghadir/static/src/js/partner_balance_fetcher.js',
            'pos_ghadir/static/src/js/partner_due_currency_convert.js',
            'pos_ghadir/static/src/js/dual_currency_display.js',
            'pos_ghadir/static/src/js/deselect_on_background_click.js',
            'pos_ghadir/static/src/js/customer_account_screens.js',
            'pos_ghadir/static/src/js/auto_enable_invoice.js',
            'pos_ghadir/static/src/js/disable_auto_invoice_download.js',
            'pos_ghadir/static/src/js/prevent_empty_payment_line.js',
            'pos_ghadir/static/src/js/partner_balance_snapshot.js',
            'pos_ghadir/static/src/js/payment_receipt.js',
            'pos_ghadir/static/src/js/payment_receipt_popup.js',
            'pos_ghadir/static/src/js/note_button_fix.js',
            'pos_ghadir/static/src/js/pricelist_round_up.js',
            'pos_ghadir/static/src/js/stock_alerts.js',
            'pos_ghadir/static/src/xml/receipt_partner_balance.xml',
            'pos_ghadir/static/src/xml/stock_alerts.xml',
            'pos_ghadir/static/src/xml/payment_receipt.xml',
            'pos_ghadir/static/src/xml/dual_currency_display.xml',
            'pos_ghadir/static/src/xml/customer_account_screens.xml',
        ],
    },
    'license': 'AGPL-3',
    'installable': True,
    'auto_install': True,
    'application': False,
}
