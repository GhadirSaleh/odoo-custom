# odoo-custom

Odoo 19 running from source inside Docker, with custom add-ons: a full accounting suite, a bespoke Point of Sale layout (`pos_ghadir`), and the MUK theme. The entire stack — database, schema init, and application — comes up with a single command on any machine that has Docker installed.

---

## Add-ons included

| Add-on | What it does |
|---|---|
| `account` | Odoo's modular accounting suite |
| `pos_ghadir` | Custom Point of Sale layout |
| `muk_web_theme` | Modern, responsive UI theme |

---

## Prerequisites

- [Docker](https://www.docker.com/) 24+
- Docker Compose v2 — verify with `docker compose version` (note: `docker compose`, not the legacy `docker-compose`)

---

## Getting started

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

```
⏳  Waiting for PostgreSQL at db:5432 ...
✅  PostgreSQL is ready.
🔧  Database not fully initialised — running first-time setup (this runs once)...
✅  Schema initialised.
```

Odoo is then available at **http://localhost:8069**.

Every subsequent `docker compose up` finds the schema already in place and skips the init entirely.

---

## Common commands

| Task | Command |
|---|---|
| Start (after first build) | `docker compose up` |
| Start in background | `docker compose up -d` |
| View live logs | `docker compose logs -f odoo` |
| Stop, keep data | `docker compose down` |
| **Wipe everything and start fresh** | `docker compose down -v` |
| Rebuild after dep changes | `docker compose up --build` |
| Shell inside Odoo container | `docker compose exec odoo bash` |
| Connect to the database | `docker compose exec db psql -U odoo odoo` |

> `docker compose down -v` permanently deletes the `odoo-db-data` and `odoo-data` named volumes. Only use it when you want a completely clean slate.

---

## Backup and restore

Backups are managed through Odoo's built-in database manager — no shell scripts required.

### Taking a backup

1. Open **http://localhost:8069/web/database/manager**
2. Click **Backup** next to the `odoo` database
3. Choose **ZIP** (includes the filestore — attachments, images, reports) or **pg_dump** (database only)
4. Download and store the file safely

### Restoring a backup

1. Open **http://localhost:8069/web/database/manager**
2. Click **Restore Database**
3. Upload your `.zip` or `.dump` file, give the restored database a name, and confirm

> **Restoring onto a fresh deployment:** if you just ran `docker compose up --build` for the first time, auto-init will have created an empty `odoo` database. You can restore directly over it by using the same database name, or restore under a different name and update `db_name` in `config/odoo.conf` then restart the stack.

---

## Development

`docker-compose.override.yml` is automatically merged by Compose on any machine that has the file present. It changes two things relative to the production baseline:

- Targets the `base` build stage — the project root is bind-mounted over `/app` so code changes are reflected immediately without rebuilding.
- Passes `--dev=all` to Odoo so Python modules, QWeb templates, and assets hot-reload on save.

Useful dev commands:

```bash
# Scaffold a new add-on (appears in addons/ immediately)
docker compose exec odoo python3 odoo-bin scaffold my_module /mnt/extra-addons

# Install or update a specific module without a full restart
docker compose exec odoo python3 odoo-bin \
  --config=/etc/odoo/odoo.conf \
  -d odoo \
  -u my_module \
  --stop-after-init
```

---

## Production

On a server where `docker-compose.override.yml` is absent, the baseline file is used on its own — the Odoo source is baked into the image instead of mounted from disk. Deploy with:

```bash
docker compose -f docker-compose.yml up -d
```

To use a pre-built image from a registry instead of building on the server, replace the `build:` block in `docker-compose.yml` with:

```yaml
image: your-registry/odoo-custom:latest
```

---

## How it works

### Repository layout

```
odoo-custom/
├── addons/                      # Custom add-ons, mounted at /mnt/extra-addons
├── config/
│   └── odoo.conf                # Odoo config: DB connection, workers, addons paths
├── odoo/                        # Odoo 19 source tree
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

### Two-stage Dockerfile

| Stage | Used in | What it contains |
|---|---|---|
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

`--workers=0` is essential here. Without it, Odoo starts in multi-process mode and `--stop-after-init` can fire on the master process before any worker has finished writing the module data — leaving the database in a broken half-initialised state. Single-process mode makes the init fully synchronous. Once it completes successfully, the entrypoint hands off to the normal `CMD` and Odoo starts serving.

---

## License

Distributed under the [Odoo Community License (LGPL-3)](https://www.gnu.org/licenses/lgpl-3.0.html).


