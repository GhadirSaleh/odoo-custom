{
    'name': 'POS Ghadir Custom UI',
    'version': '1.0',
    'category': 'Point of Sale',
    'author': 'Cybrosys Techno Solutions',
    'summary': 'POS enhancements: customer accounts, multi-currency, receipt balance, workflow optimizations',
    'description': """
POS Ghadir Custom UI - Comprehensive POS Extension
===================================================

A comprehensive Point of Sale extension module for Odoo 19 that enhances
the standard POS interface with advanced customer account management,
multi-currency support, and workflow optimizations.

Customer Account Management
---------------------------
* Customer Accounts Screen — Dedicated POS screen showing all customers with real-time balances
* Account Statement View — Per-customer accounting history with debit/credit and running balance
* Make Payment — Process payments from POS, creating proper journal entries
* Account Adjustments — Add or remove amounts with mandatory audit notes
* Partner Balance Display — Shows customer balance on the customer selection button

Multi-Currency Support
----------------------
* Automatic Currency Conversion — Fetches live rates, displays company currency equivalent
* Converted Total Display — Shows converted amount in () on order screen and receipt
* Partner Due Conversion — Converts partner balance + order total with proper rounding

Receipt Enhancements
--------------------
* Previous Balance — Shows customer's outstanding balance on receipt (حساب سابق)
* Remaining Balance — Shows converted remaining balance (باقي الحساب)

Workflow Optimizations
----------------------
* Quick Cancel Order — One-click order cancellation without confirmation
* Pricelist Cycler — Navbar button to cycle through available pricelists
* Default Quantity of 2 — Products added with qty 2 instead of 1
* Auto-Enable Invoice — Invoice generation enabled by default
* Disable Auto PDF Download — Prevents automatic invoice PDF download
* Clean Currency Format — Removes trailing decimal zeros from prices
* Disable Price Override — Disables the numpad price modification button

Technical Details
-----------------
* Odoo Version: 19.0
* Dependencies: point_of_sale, account, sale, purchase
* License: AGPL-3
* Auto Install: Yes

Usage
-----
1. Customer Accounts: Hamburger menu (☰) → Customer Accounts
2. View Balance: Select a customer — balance appears next to their name
3. Make Payment: Open customer account → Make Payment → enter amount
4. Adjustments: Use Add/Remove buttons with required reason notes
5. Cycle Pricelists: Click pricelist button in navbar
6. Quick Cancel: Click Clear button in navbar
    """,
    'depends': ['point_of_sale', 'account', 'sale', 'purchase'],
    'assets': {
        'web.assets_backend': [
            'pos_ghadir/static/src/scss/hide_chatter.scss',
        ],
        'point_of_sale._assets_pos': [
            'pos_ghadir/static/src/scss/pos_custom.scss',
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
            'pos_ghadir/static/src/xml/receipt_partner_balance.xml',
            'pos_ghadir/static/src/xml/dual_currency_display.xml',
            'pos_ghadir/static/src/xml/customer_account_screens.xml',
        ],
    },
    'license': 'AGPL-3',
    'installable': True,
    'auto_install': True,
    'application': False,
}
