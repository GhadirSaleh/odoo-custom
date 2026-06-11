{
    "name": "Product Cost from Last Purchase",
    "version": "19.0.1.0.0",
    "category": "Inventory",
    "summary": "Auto-update product cost to the latest purchase price per category",
    "depends": ["purchase_stock", "stock_account"],
    "data": [
        "views/product_category_views.xml",
    ],
    "installable": True,
    "auto_install": False,
    "license": "LGPL-3",
}
