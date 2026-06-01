# AGENTS.md

## Stack
- **Odoo 19** (`image: odoo:19`), **PostgreSQL 15**, **Docker Compose v2**
- All work inside Docker containers — never run Odoo or Python locally
- **nginx runs on the host**, not in Docker — SSL termination, proxies to Odoo containers

## Quick start
```bash
cp .env.example .env
docker compose up      # auto-inits DB on first run
```

## Developer commands
| Task | Command |
|---|---|
| Start (foreground) | `docker compose up` |
| Start (background) | `docker compose up -d` |
| Shell into container | `docker compose exec odoo bash` |
| Update a module | `docker compose exec odoo odoo -c /etc/odoo/odoo.conf --db_host=db --db_user=odoo --db_password=odoo -d odoo -u <module> --stop-after-init --workers=0 --http-port=8067` |
| Run module tests | `docker compose exec odoo odoo -c /etc/odoo/odoo.conf --db_host=db --db_user=odoo --db_password=odoo -d odoo -u <module> --test-enable --stop-after-init --workers=0 --http-port=8067` |
| Scaffold new addon | `docker compose exec odoo odoo scaffold <name> /mnt/extra-addons` |
| Connect to database | `docker compose exec db psql -U odoo odoo` |
| View logs | `docker compose logs -f odoo` |
| **Wipe everything** | `docker compose down -v` |

Looking up Odoo's internal APIs:
```bash
# Search for model method definitions (Odoo 19 style)
docker compose exec odoo grep -rn "@api.model\|def search\|def _search\|def name_get\|def name_search" /usr/lib/python3/dist-packages/odoo/models.py --include="*.py"

# Search across all Odoo source for a method name
docker compose exec odoo grep -rn "def _compute_balance" /usr/lib/python3/dist-packages/odoo/ --include="*.py"
```

## Architecture
- **`docker-compose.yml`** — production baseline. Uses `image: odoo:19`, mounts config/addons read-only, passes `command: odoo --config=/etc/odoo/odoo.conf` for explicit config path.
- **`docker-compose.override.yml`** — auto-merged in dev: config/addons writable, passes `--dev=all` for hot-reload. Absent in production.
- **`scripts/custom-entrypoint.sh`** — waits for Postgres, auto-fixes config write permissions (`chmod o+w`), runs one-shot init (`-i base --workers=0 --stop-after-init`) on first start, then hands off to the official `/entrypoint.sh`. `--workers=0` is critical — without it init can leave the DB half-initialised.
- **Entrypoint env vars**: reads `HOST`, `USER`, `PASSWORD`, `PORT`, `DB` (short names set by Compose `environment:` block), NOT `POSTGRES_*` variables. These are passed as `--db_*` CLI args to the init command, and also detected by the official entrypoint when `db_*` are absent from `odoo.conf`.
- **`config/odoo.conf`**: `addons_path = /mnt/extra-addons`, `workers = 2`, `proxy_mode = True`. No `db_*` settings — they come from env vars via the official entrypoint as CLI args. Admin password hash is PBKDF2 of `"hala"` — works silently, no prompt.
- **Init is one-shot**: skips re-init once `base` module is installed. Force re-init: `docker compose down -v`.
- **No CI / lint tooling** — Odoo tests via `--test-enable`.
- **Odoo source lives in the container** at `/usr/lib/python3/dist-packages/odoo/` — useful for looking up base model APIs, reading core module implementations, or finding method signatures. Access via `docker compose exec odoo bash` or one-shot `docker compose exec odoo grep ...`.

## Host infrastructure (nginx + certbot)
- **nginx** runs on the host, config at `/etc/nginx/sites-available/odoo` (deployed from `config/odoo-nginx-config`). Proxies to `127.0.0.1:8069` (Odoo) and `127.0.0.1:8072` (longpolling/websocket).
- **Let's Encrypt** cert at `/etc/letsencrypt/live/halanuts.ddns.net/`. Renewal via cron on host: `0 3 * * * /usr/bin/certbot renew --quiet --nginx && systemctl reload nginx`.
- **Self-signed LAN cert** at `/etc/nginx/ssl/192.168.1.16.pem` (10-year expiry, not managed by certbot).
- **No-IP DDNS** points `halanuts.ddns.net` → `82.137.203.114` (STE static IP).
- Full host setup guide in [`SETUP.md`](SETUP.md).

## Add-ons
- **`addons/`** — 17 modules: custom + third-party (no Odoo core).
- **Custom modules**: `pos_ghadir` (POS UI, multi-currency, receipt, customer account management, payment receipt popup) has `auto_install: True` — activates automatically when deps are present.
- **Third-party suites**: `om_account_*` + `om_fiscal_year` + `om_recurring_payments` (accounting), `accounting_pdf_reports`, `muk_web_*` (UI theme), `bi_pos_default_customer`.

## Gotchas
- `.env` is gitignored and **required** — stack refuses to start without `POSTGRES_PASSWORD`.
- Code changes reflect instantly in dev (bind-mount). No rebuild needed.
- Backup/restore via Odoo's DB manager at `/web/database/manager`, not shell scripts.
- First-run init uses `--without-demo`. Re-init requires `docker compose down -v`.
- DB manager admin password is `"hala"` (or whichever value you set in `admin_passwd`).
- **Syriatel mobile (AS48065)** cannot reach `82.137.203.114` (broken peering to STE). Workaround: VPN or Cloudflare Tunnel.
- **Module update commands need `--db_host=db --db_user=odoo --db_password=odoo`** because `odoo.conf` has no `db_*` settings (they're passed via the entrypoint, which `docker compose exec odoo odoo ...` bypasses). Also use `--workers=0 --http-port=8067` to avoid port conflicts with the running server.
- **Custom POS pages need `static storeOnOrder = false`** to allow the Register button to navigate back to ProductScreen. Without it, the order remembers the custom page and Register tries to go back to it instead of ProductScreen.
- **Payment receipt popup** (`payment_receipt_popup.js`) uses `makeAwaitable` to gate order refresh behind popup close. Dummy `pos.order` record is deleted after popup closes.
