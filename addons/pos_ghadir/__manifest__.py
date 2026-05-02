{
    'name': 'POS Ghadir Custom UI',
    'version': '1.0',
    'category': 'Point of Sale',
    'author': 'Cybrosys Techno Solutions',
    'depends': ['point_of_sale', 'om_account_accountant', 'sale', 'purchase'],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_ghadir/static/src/scss/pos_custom.scss',
            'pos_ghadir/static/src/js/hide_price_button.js',
            'pos_ghadir/static/src/js/pricelist_toggle_button.js',
            'pos_ghadir/static/src/js/clear_cart_button.js',
            'pos_ghadir/static/src/js/default_qty_two.js',
            'pos_ghadir/static/src/js/remove_decimal_zeros.js',
        ],
    },
    'license': 'AGPL-3',
    'installable': True,
    'auto_install': True,
    'application': False,
}
