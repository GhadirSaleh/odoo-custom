# odoo-custom

[![Odoo 19](https://img.shields.io/badge/Odoo-19.0-7C7BAD?logo=odoo)](https://www.odoo.com)
[![PostgreSQL 15](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-LGPL--3-blue)](https://www.gnu.org/licenses/lgpl-3.0.html)

Odoo 19 with custom Point of Sale enhancements, a full accounting suite, and the MUK web theme. The entire stack — database, schema init, and application — comes up with a single command on any machine that has Docker installed.

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

#### Receipt Enhancements

- Previous Balance — Shows customer's outstanding balance on receipt (حساب سابق)
- Remaining Balance — Shows converted remaining balance (باقي الحساب)

#### Workflow Optimizations

- Quick Cancel Order — One-click order cancellation without confirmation
- Pricelist Cycler — Navbar button to cycle through available pricelists
- Default Quantity of 2 — Products added with qty 2 instead of 1
- Auto-Enable Invoice — Invoice generation enabled by default
- Disable Auto PDF Download — Prevents automatic invoice PDF download
- Clean Currency Format — Removes trailing decimal zeros from prices
- Disable Price Override — Disables the numpad price modification button

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

Edit `.env` and set a strong password:

```dotenv
POSTGRES_DB=odoo
POSTGRES_USER=odoo
POSTGRES_PASSWORD=a_strong_password_here

ODOO_PORT=8069
ODOO_LONGPOLL_PORT=8072
```

`.env` is listed in `.gitignore` and must never be committed. The stack will refuse to start if `POSTGRES_PASSWORD` is missing.

### 2. Start

```bash
docker compose up
```

On the very first run the entrypoint detects an empty database and initialises the Odoo schema automatically before serving:

```
Waiting for PostgreSQL at db:5432 ...
PostgreSQL is ready.
Database not fully initialised — running first-time setup (this runs once)...
Schema initialised.
```

Odoo is then available at **<http://localhost:8069>**.

Every subsequent `docker compose up` finds the schema already in place and skips the init entirely.

---

## Common Commands

| Task | Command |
| --- | --- |
| Start (background) | `docker compose up -d` |
| View live logs | `docker compose logs -f odoo` |
| Stop, keep data | `docker compose down` |
| **Wipe everything** | `docker compose down -v` |
| Shell into container | `docker compose exec odoo bash` |
| Connect to database | `docker compose exec db psql -U odoo odoo` |
| Update a module | `docker compose exec odoo odoo -c /etc/odoo/odoo.conf -d odoo -u <module> --stop-after-init` |
| Run module tests | `docker compose exec odoo odoo -c /etc/odoo/odoo.conf -d odoo -u <module> --test-enable --stop-after-init` |
| Scaffold new addon | `docker compose exec odoo odoo scaffold <name> /mnt/extra-addons` |

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

> **Restoring onto a fresh deployment:** if you just ran `docker compose up` for the first time, auto-init will have created an empty `odoo` database. You can restore directly over it by using the same database name, or restore under a different name and update `db_name` in `config/odoo.conf` then restart the stack.

---

## Development

`docker-compose.override.yml` is automatically merged by Compose on any machine that has the file present. Relative to the production baseline, it makes:

- **Config and addons writable** — you can edit `config/odoo.conf` and scaffold new modules live.
- **`--dev=all`** — Odoo hot-reloads Python modules, QWeb templates, and assets on save.

Code changes reflect instantly. No rebuild is ever needed.

---

## Production

On a server where `docker-compose.override.yml` is absent, the baseline file is used on its own — config and addons are mounted read-only. Deploy with:

```bash
docker compose up -d
```

The base `docker-compose.yml` includes `command: odoo --config=/etc/odoo/odoo.conf` so Odoo always starts with an explicit config path. No flag needed.

### Longpolling & reverse proxy

The `workers = 2` setting in `config/odoo.conf` is required for longpolling to function correctly. This enables real-time features such as POS order synchronization and chat. Ensure your reverse proxy forwards both port 8069 (HTTP) and port 8072 (longpolling) to the Odoo container.

| Aspect | Local Development | Production (HTTPS) |
| --- | --- | --- |
| Workers | 0 (dev mode, single process) | 2 (multi-process) |
| Access | `http://localhost:8069` | `https://your-domain.com` |
| Longpolling | Port 8072 (not required for basic dev) | Port 8072 required for real-time features |
| Config file | `config/odoo.conf` is writable | `config/odoo.conf` is read-only |
| Addons | Writable (bind-mount) | Read-only (bind-mount) |
| Reverse proxy | Not needed | Required (nginx, Caddy, etc.) for HTTPS |

---

## Architecture

```
odoo-custom/
├── addons/                      # 17 custom + third-party modules
├── config/
│   └── odoo.conf                # DB connection, workers, addons path
├── scripts/
│   └── custom-entrypoint.sh     # Auto-init wrapper → official /entrypoint.sh
├── .env.example                 # Template — copy to .env
├── .gitignore
├── docker-compose.yml           # Production baseline
├── docker-compose.override.yml  # Dev overrides (auto-merged locally)
└── products+cost.xlsx           # Reference master data
```

### Container startup

The Odoo service uses the official `odoo:19` Docker image with a custom entrypoint wrapper (`scripts/custom-entrypoint.sh`). On each start:

1. **Wait for Postgres** — polls `pg_isready` until the database is accepting connections.
2. **Fix config permissions** — runs `chmod o+w` on the config so Odoo can save password changes via the UI.
2. **Check if initialised** — queries `ir_module_module` for the `base` module's state.
3. **Auto-init on first run** — if `base` is not installed, runs a one-shot initialisation:

   ```bash
   odoo -c /etc/odoo/odoo.conf -d odoo -i base --without-demo --workers=0 --stop-after-init
   ```

   `--workers=0` ensures init runs synchronously. Without it, `--stop-after-init` can fire on the master process before workers finish writing module data, leaving the database half-initialised.

4. **Hand off** — delegates to the image's built-in `/entrypoint.sh`, which resolves DB connection parameters and starts Odoo normally.

On subsequent starts, the check passes and init is skipped.

### Configuration

`config/odoo.conf` sets `addons_path = /mnt/extra-addons` (mapped from the `addons/` directory) and `workers = 2`. Database connection params (`db_host`, `db_port`, `db_user`, `db_password`) are omitted — they come from env vars (`HOST`, `PORT`, `USER`, `PASSWORD`) via the official entrypoint as CLI args. The `command:` in `docker-compose.yml` passes `--config=/etc/odoo/odoo.conf` explicitly (overridden in dev with `--dev=all` via `docker-compose.override.yml`).

The admin password is the PBKDF2-SHA512 hash of `"hala"` — used to log into the database manager at `/web/database/manager`. No password change prompt.

---

## License

Distributed under the [Odoo Community License (LGPL-3)](https://www.gnu.org/licenses/lgpl-3.0.html).
