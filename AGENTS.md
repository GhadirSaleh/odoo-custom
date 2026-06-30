# AGENTS.md

## Stack
- **Odoo 19** (`image: odoo:19`), **PostgreSQL 15**, **Docker Compose v2**
- All work inside Docker containers — never run Odoo or Python locally
- **nginx runs on the host**, not in Docker — SSL termination, proxies to containers
- **No CI / lint tooling** — Odoo tests via `--test-enable` only
- All 18 modules in `addons/`: 2 custom (`pos_ghadir`, `product_last_purchase_cost`), 16 third-party

## Quick start
```bash
cp .env.example .env
docker compose up      # auto-inits DB on first run
```

## Developer commands
| Task | Command |
|---|---|
| Shell into container | `docker compose exec odoo bash` |
| Update a module | `docker compose exec odoo odoo -c /etc/odoo/odoo.conf --db_host=db --db_user=odoo --db_password=odoo -d odoo -u <module> --stop-after-init --workers=0 --http-port=8067` |
| Run module tests | Same as above, add `--test-enable` |
| Scaffold new addon | `docker compose exec odoo odoo scaffold <name> /mnt/extra-addons` |
| Connect to database | `docker compose exec db psql -U odoo odoo` |
| View logs | `docker compose logs -f odoo` |
| **Wipe everything** | `docker compose down -v` |

## Architecture
- **`docker-compose.yml`** — production: read-only mounts, `command: odoo --config=/etc/odoo/odoo.conf`
- **`docker-compose.override.yml`** — dev: writable mounts, `--dev=all` hot-reload (auto-merged)
- **`scripts/custom-entrypoint.sh`** — waits for Postgres, fixes config permissions, runs one-shot init (`-i base --workers=0 --stop-after-init`) on first start, then hands off to official `/entrypoint.sh`
- **`config/odoo.conf`**: `addons_path = /mnt/extra-addons`, `workers = 2`, `proxy_mode = True`. No `db_*` settings — from env vars (`HOST`, `USER`, `PASSWORD`, `PORT`, `DB`). Admin password is PBKDF2 of `"hala"` — no prompt.
- **Init is one-shot**: skips re-init once `base` module installed. Force re-init: `docker compose down -v`.
- `.env` is gitignored and **required** — stack refuses to start without `POSTGRES_PASSWORD`. Code changes reflect instantly in dev (bind-mount). Backup/restore via Odoo DB manager at `/web/database/manager`.
- **`.odoo-src/`** — cached Odoo container source for AI tooling. Re-copy after image update: `docker compose exec odoo tar -C /usr/lib/python3/dist-packages/odoo -cf - . | tar -C .odoo-src/odoo -xf -`

## POS JS development patterns (easy to get wrong)

- **`type='json'` controllers**: Odoo JSON-RPC routes require `{params: {...}}` wrapper in `fetch()` bodies:
  ```js
  fetch("/pos_ghadir/import_fields", { method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({params: {}}),
  });
  ```
- **Owl templates**:
  - `t-foreach` **requires** `t-key`; when headers may repeat, use `t-key="header + '_' + header_index"`
  - `this.methodName()` in event handlers — bare `methodName()` loses `this`
  - Arrow class fields (`setMapping = (x, y) => {...}`) for template-bound methods
- **`_t` in templates**: store in `this._t` in `setup()` — the imported symbol is not available in template scope:
  ```js
  import { _t } from "@web/core/l10n/translation";
  setup() { this._t = _t; }
  ```
- **Dialogs**: Use `window.posmodel.dialog` (not `window.posmodel.chrome.dialog`):
  ```js
  await new Promise(resolve => dialog.add(MyPopup, { getPayload: () => resolve() }));
  ```
  The `makeAwaitable` utility from `@point_of_sale/app/utils/make_awaitable_dialog` is used for numeric-input popups.
- **Dummy-order receipt pattern**: Extracted to `account_utils.showPaymentReceipt()` to avoid duplicating the create-use-delete cycle for dummy `pos.order` records in payment/withdraw/settle flows.
- **Currency formatting utility**: `currency_utils.js` exports `formatAmountAfterSymbol(amount, currencyOrId)` that strips the symbol from Odoo's `formatCurrency` and places it after the number for Arabic-compatible display. Accepts both currency objects and numeric IDs.
- **Shared account helpers**: `account_utils.js` exports `formatBalance`, `formatPosBalance`, `isMultiCurrency`, and `convertToPosCurrency` — all take `pos` as first param to avoid `this` binding issues in utility functions.
- **Extracting inner functions**: Instead of nested closures in Python model methods, extract as proper `@api.model` methods (e.g. `_build_currency_move_line` from `_create_customer_order`) for testability and cleaner code.
- **Avoid duplicating Odoo core methods**: When only adding timing instrumentation, wrap `super()` and log total time instead of copying the entire method body. Per-step breakdown is lost but core compatibility is preserved.
- **`_load_pos_data_fields`**: Use `if 'field' not in fields: fields.append('field')` instead of `fields += ['field']` to prevent duplicates when super already includes the field.

## Gotchas
- Module update commands need `--db_host=db --db_user=odoo --db_password=odoo` because `odoo.conf` has no `db_*` settings — they come from the entrypoint, which `docker compose exec odoo odoo ...` bypasses. Use `--workers=0 --http-port=8067` to avoid port conflict with the running server.
- **Custom POS pages** need `static storeOnOrder = false` — without it, Register navigates back to the custom page instead of ProductScreen.
- **Pricelist rounding threshold** (`product.pricelist.rounding_threshold`, 0.0–1.0 Float) replaces old boolean `round_up`. Implemented via duplicated `_round_with_threshold()` in both Python and JS because the rounding step sits mid-method — calling super and re-rounding gives wrong results.
- **Price Catalog PDF**: Paperformat must set all margins to 0 — `@page { margin: 0 }` alone won't override wkhtmltopdf's `--margin-top`. Use `table-layout: fixed` (wkhtmltopdf ignores `max-width` on cells).
- **Quick Rate Setter** uses `sudo()` because `res.currency.rate` write needs Account Manager group. Triggers `pos.reloadData(true)` — unsaved orders WILL be lost.
- **Stock update mode** must be **"In real time"** in company settings — without it stock is not decremented on POS orders.
- All user-facing strings must be wrapped in `_t()` for Arabic translation support. Translations live in `i18n/ar_001.po`.
