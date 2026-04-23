# -*- coding: utf-8 -*-
# === © BIGBANG - ODOO MANIFEST FILE === #
# == © BIGBANG ERP - POS AZURE THEME == #

{
  # ---- MANIFEST HEADER --- #
  "name": "Azure Theme POS",
  "version": "17.0.1.0",
  "category": "Theme/Point of Sale",
  "summary":"""
    Custom styling for the Point of Sale interface with our Azure-inspired theme.
  """,
  
  
  # --- MODULE AUTHORING --- #
  "author": "BigBang.ma",
  "maintainer": "tchisama",
  "support": "odoo@bigbang.ma",
  "website": "https://bigbang.ma",
  "license": 'GPL-3',
  
  
  # --- MODULE STACK --- #
  "depends": ['base', 'point_of_sale'], #? ==> 'base' is necessary in order the module to be updated when the `base` updated.
  
  
  # --- MODULE ASSETS --- #
  "assets": {
    "point_of_sale._assets_pos": [
      ('prepend', 'bbg_pos_azure_theme/static/src/css/azure_theme_assets.css'),
      'bbg_pos_azure_theme/static/src/css/azure_theme.css',
    ],
  },
  
  
  # --- MODULE INTEGRATION --- #
  "images": ["static/description/assets/images/thumbnail.gif", "static/description/assets/images/theme_screenshot.gif"],
  "price": "0.0",
  "currency": "USD",
  "installable": True,
  "application": False,
  "auto_install": False,
  "sequence": 1,
}

