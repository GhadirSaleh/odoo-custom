# odoo-custom

[![Odoo 19](https://img.shields.io/badge/Odoo-19.0-7C7BAD?logo=odoo)](https://www.odoo.com)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://www.python.org)
[![PostgreSQL 15](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-LGPL--3-blue)](https://www.gnu.org/licenses/lgpl-3.0.html)

Odoo 19 running from source inside Docker, with custom Point of Sale enhancements, a full accounting suite, and the MUK web theme. The entire stack — database, schema init, and application — comes up with a single command on any machine that has Docker installed.

---

## Features

### POS Enhancements (`pos_ghadir`)

#### Customer Account Management

- Customer Accounts Screen — Dedicated POS screen showing all customers with real-time balances
- Account Statement View — Per-customer accounting history with debit/credit and running balance
- Make Payment — Process payments from POS, creating proper journal entries
- Account Adjustments — Add or remove amounts with mandatory audit notes
- Partner Balance Display — Shows customer balance on the customer selection button

#### Multi-Currency Support

- Automatic Currency Conversion — Fetches live rates, displays company currency equivalent
- Converted Total Display — Shows converted amount in parentheses on order screen and receipt
- Partner Due Conversion — Converts partner balance and order total with proper rounding

## Receipt Enhancements

- Previous Balance — Shows customer's outstanding balance on receipt (حساب سابق)
- Remaining Balance — Shows converted remaining balance (باقي الحساب)

### Workflow Optimizations

- Quick Cancel Order — One-click order cancellation without confirmation
- Pricelist Cycler — Navbar button to cycle through available pricelists
- Default Quantity of 2 — Products added with qty 2 instead of 1
- Auto-Enable Invoice — Invoice generation enabled by default
- Disable Auto PDF Download — Prevents automatic invoice PDF download
- Clean Currency Format — Removes trailing decimal zeros from prices
- Disable Price Override — Disables the numpad price modification button

### Sales Order Integration (`wt_create_so_from_pos`)

- Create sale orders directly from the POS screen
- View created sales orders from within POS

### Accounting Suite

| Module | Purpose |
| --- | --- |
| `om_account_accountant` | Full accounting dashboard |
| `om_account_asset` | Asset management and depreciation |
| `om_account_budget` | Budget planning and tracking |
| `om_account_followup` | Payment follow-up automation |
| `om_account_daily_reports` | Daily financial reports |
| `om_recurring_payments` | Recurring payment processing |
| `om_fiscal_year` | Fiscal year management |
| `accounting_pdf_reports` | PDF report generation (trial balance, P&L, balance sheet, etc.) |

### UI & Theme

| Module | Purpose |
| --- | --- |
| `muk_web_theme` | Modern, responsive UI theme |
| `muk_web_appsbar` | Application sidebar |
| `muk_web_chatter` | Enhanced chatter component |
| `muk_web_colors` | Custom color scheme |
| `muk_web_dialog` | Dialog improvements |
| `muk_web_group` | Group view enhancements |
| `muk_web_refresh` | Refresh behavior |
| `bbg_pos_azure_theme` | Azure-themed POS interface |
| `bi_pos_default_customer` | Default customer assignment for POS |

---

## Prerequisites

- [Docker](https://www.docker.com/) 24+
- Docker Compose v2 — verify with `docker compose version` (note: `docker compose`, not the legacy `docker-compose`)

---

## Quick Start

### 1. Copy the environment file

```bash
cp .env.example .env
```

Edit `.env` and set a real password:

```dotenv
POSTGRES_DB=odoo
POSTGRES_USER=odoo
POSTGRES_PASSWORD=a_strong_password_here

ODOO_PORT=8069
ODOO_LONGPOLL_PORT=8072
```

`.env` is listed in `.gitignore` and must never be committed. The stack will refuse to start if `POSTGRES_PASSWORD` is missing.

### 2. Build and start

```bash
docker compose up --build
```

On the very first run the entrypoint detects an empty database and initialises the Odoo schema automatically before serving:

```ssh
⏳  Waiting for PostgreSQL at db:5432 ...
✅  PostgreSQL is ready.
🔧  Database not fully initialised — running first-time setup (this runs once)...
✅  Schema initialised.
```

Odoo is then available at **<http://localhost:8069>**.

Every subsequent `docker compose up` finds the schema already in place and skips the init entirely.

---

## Common Commands

| Task | Command |
| --- | --- |
| Start (background) | `docker compose up -d` |
| Rebuild after dep change | `docker compose up --build` |
| View live logs | `docker compose logs -f odoo` |
| Stop, keep data | `docker compose down` |
| **Wipe everything** | `docker compose down -v` |
| Shell into container | `docker compose exec odoo bash` |
| Connect to database | `docker compose exec db psql -U odoo odoo` |
| Update a module | `docker compose exec odoo python3 odoo-bin --config=/etc/odoo/odoo.conf -d odoo -u <module> --stop-after-init` |
| Scaffold new addon | `docker compose exec odoo python3 odoo-bin scaffold <name> /mnt/extra-addons` |

> `docker compose down -v` permanently deletes the `odoo-db-data` and `odoo-data` named volumes. Only use it when you want a completely clean slate.

---

## Backup and Restore

Backups are managed through Odoo's built-in database manager — no shell scripts required.

### Taking a backup

1. Open **<http://localhost:8069/web/database/manager>**
2. Click **Backup** next to the `odoo` database
3. Choose **ZIP** (includes the filestore — attachments, images, reports) or **pg_dump** (database only)
4. Download and store the file safely

### Restoring a backup

1. Open **<http://localhost:8069/web/database/manager>**
2. Click **Restore Database**
3. Upload your `.zip` or `.dump` file, give the restored database a name, and confirm

> **Restoring onto a fresh deployment:** if you just ran `docker compose up --build` for the first time, auto-init will have created an empty `odoo` database. You can restore directly over it by using the same database name, or restore under a different name and update `db_name` in `config/odoo.conf` then restart the stack.

---

## Local vs Production

| Aspect | Local Development | Production (HTTPS) |
| --- | --- | --- |
| Workers | 0 (dev mode, single process) | 2 (multi-process) |
| Access | `http://localhost:8069` | `https://your-domain.com` |
| Longpolling | Port 8072 (not required for basic dev) | Port 8072 required for real-time features |
| Config file | `config/odoo.conf` is writable | `config/odoo.conf` is read-only |
| Source code | Bind-mounted (live reload) | Baked into image |
| Reverse proxy | Not needed | Required (nginx, Caddy, etc.) for HTTPS |

**Production note:** The `workers = 2` setting in `config/odoo.conf` is required for longpolling to function correctly over HTTPS. This enables real-time features such as POS order synchronization and chat. Without workers, longpolling falls back to polling which degrades performance. Ensure your reverse proxy forwards both port 8069 (HTTP) and port 8072 (longpolling) to the Odoo container.

---

## Development

`docker-compose.override.yml` is automatically merged by Compose on any machine that has the file present. It changes two things relative to the production baseline:

- Targets the `base` build stage — the project root is bind-mounted over `/app` so code changes are reflected immediately without rebuilding.
- Passes `--dev=all` to Odoo so Python modules, QWeb templates, and assets hot-reload on save.

Code changes reflect instantly in dev (bind-mount). Only rebuild when `requirements.txt` or `Dockerfile` changes.

---

## Production Deployment

On a server where `docker-compose.override.yml` is absent, the baseline file is used on its own — the Odoo source is baked into the image instead of mounted from disk. Deploy with:

```bash
docker compose -f docker-compose.yml up -d
```

To use a pre-built image from a registry instead of building on the server, replace the `build:` block in `docker-compose.yml` with:

```yaml
image: your-registry/odoo-custom:latest
```

---

## Architecture

### Repository Layout

```ssh
odoo-custom/
├── addons/                      # ~640 modules: Odoo core + third-party + custom
├── config/
│   └── odoo.conf                # Odoo config: DB connection, workers, addons paths
├── odoo/                        # Odoo 19 source tree (upstream, read-only)
├── scripts/
│   └── entrypoint.sh            # Container startup: wait for DB + auto-init
├── .env.example                 # Copy to .env and fill in credentials
├── .gitignore
├── docker-compose.yml           # Production baseline
├── docker-compose.override.yml  # Dev overrides (auto-merged locally)
├── Dockerfile
├── Odoo_Master_Data.xlsx        # Reference master data
├── odoo-bin                     # Odoo entry-point binary
└── requirements.txt             # Pinned Python dependencies
```

### Two-Stage Dockerfile

| Stage | Used in | What it contains |
| --- | --- | --- |
| `base` | Dev (override targets this) | OS packages, wkhtmltopdf, Python deps, entrypoint, `USER odoo` |
| `app` | Production | Everything from `base` + the full source tree baked in |

`requirements.txt` is copied and installed before the source tree, so the pip layer is only invalidated when dependencies actually change — editing application code does not trigger a reinstall.

The `ENTRYPOINT`, `USER odoo`, and the entrypoint script copy all live in `base`, not just in `app`. This ensures the dev build (which targets `base` and skips the source `COPY`) still runs as the correct user and goes through the same startup logic as production.

### Entrypoint (`scripts/entrypoint.sh`)

Two things happen before Odoo starts:

**1. Wait for Postgres.** The script polls `pg_isready` until the database is accepting connections. This is a belt-and-suspenders layer on top of the Compose `healthcheck` — Odoo will never crash on startup because it raced ahead of the database.

**2. Auto-init on first run.** The script checks whether the `base` module is present and in state `installed` inside `ir_module_module`. On a fresh database this check fails and the entrypoint runs a one-shot initialisation:

```bash
python3 odoo-bin -d odoo -i base --without-demo --workers=0 --stop-after-init
```

`--workers=0` is used only for this one-shot init to ensure it runs synchronously in single-process mode. Without it, `--stop-after-init` can fire on the master process before any worker has finished writing module data, leaving the database half-initialised. Once init completes, the entrypoint hands off to the normal `CMD` and Odoo starts serving with the worker count defined in `config/odoo.conf`.

---

## License

Distributed under the [Odoo Community License (LGPL-3)](https://www.gnu.org/licenses/lgpl-3.0.html).
