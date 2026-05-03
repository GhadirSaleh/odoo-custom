# odoo-custom

A source-based Odoo deployment with custom add-ons for accounting, a custom POS layout (`pos_ghadir`), and the MUK theme — containerised with a production-ready Docker setup.

---

## Add-ons

| Add-on | Description |
|---|---|
| **Accounting** | Odoo's modular accounting suite |
| **pos_ghadir** | Custom Point of Sale layout |
| **MUK Theme** | Modern, responsive UI theme |

---

## Project layout

```
odoo-custom/
├── addons/                     # Custom add-ons mounted at runtime
├── config/
│   └── odoo.conf               # Odoo configuration file
├── odoo/                       # Odoo source (from upstream)
├── scripts/
│   ├── entrypoint.sh           # Container startup script
│   └── restore.sh              # DB + filestore restore helper
├── .env.example                # Environment variable template → copy to .env
├── .gitignore
├── docker-compose.yml          # Production baseline
├── docker-compose.override.yml # Dev overrides (auto-applied locally)
├── Dockerfile
├── odoo-bin                    # Odoo entry point binary
└── requirements.txt
```

---

## Prerequisites

- [Docker](https://www.docker.com/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2 (the `docker compose` plugin, not `docker-compose`)

---

## Setup

### 1. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set a strong `POSTGRES_PASSWORD`. The stack will refuse to start if this variable is missing.

```dotenv
POSTGRES_DB=odoo
POSTGRES_USER=odoo
POSTGRES_PASSWORD=your_strong_password_here

ODOO_PORT=8069
ODOO_LONGPOLL_PORT=8072
```

> **Never commit `.env` to version control.** It is already listed in `.gitignore`.

---

## Development

In development, `docker-compose.override.yml` is merged automatically. It mounts the project root into the container so code changes are reflected immediately without rebuilding, and passes `--dev=all` to Odoo for hot-reloading.

### First run

```bash
docker compose up --build
```

Builds the image (system deps + pip packages) and starts both services. Subsequent runs skip the build unless `Dockerfile` or `requirements.txt` change.

### Normal start

```bash
docker compose up
```

### Restore a database snapshot (optional)

To start from a known-good state:

```bash
cd scripts && chmod +x restore.sh && ./restore.sh
```

This restores the Odoo filestore together with the database dump.

### Stop (keep data)

```bash
docker compose down
```

Containers are removed; named volumes (`odoo-db-data`, `odoo-data`) are preserved.

### Full reset (destroy all data)

```bash
docker compose down -v
```

> ⚠️ This permanently deletes the database and filestore volumes.

---

## Production

In production you want the Odoo source **baked into the image** rather than mounted from the host. The base `docker-compose.yml` already does this — just make sure you do **not** include `docker-compose.override.yml`:

```bash
docker compose -f docker-compose.yml up -d
```

Or build and push the image to a registry first:

```bash
docker build --target app -t your-registry/odoo-custom:latest .
docker push your-registry/odoo-custom:latest
```

Then deploy `docker-compose.yml` on the server, pointing `image:` at your registry tag instead of `build:`.

---

## How the Docker setup works

### Two-stage Dockerfile

| Stage | Purpose |
|---|---|
| `base` | Installs OS packages, wkhtmltopdf, and all Python deps. Used directly in dev. |
| `app` | Builds on `base` and bakes the source code into the image. Used in production. |

Copying `requirements.txt` before the rest of the source means the pip layer is cached unless deps actually change — a code-only edit does not re-run `pip install`.

### Compose file split

| File | When used | What it does |
|---|---|---|
| `docker-compose.yml` | Always (baseline) | Postgres + Odoo with named volumes, named network, and secrets from `.env` |
| `docker-compose.override.yml` | Automatically in dev | Targets the `base` stage, bind-mounts source, enables `--dev=all` |

This means `docker compose up` in a checkout is development mode by default. On a server where the override file doesn't exist, you get the production baseline.

### Entrypoint

`scripts/entrypoint.sh` polls `pg_isready` before handing off to the Odoo process. This is a belt-and-suspenders safety net on top of the Compose `healthcheck` — Odoo will never crash on startup because it tried to connect before Postgres was ready.

---

## Useful commands

```bash
# Tail Odoo logs
docker compose logs -f odoo

# Open a shell inside the running container
docker compose exec odoo bash

# Run an Odoo scaffold for a new module
docker compose exec odoo python3 odoo-bin scaffold my_module /mnt/extra-addons

# Update a specific module
docker compose exec odoo python3 odoo-bin \
  --config=/etc/odoo/odoo.conf \
  -u my_module \
  --stop-after-init

# Connect to the database directly
docker compose exec db psql -U odoo odoo
```

---

## License

Distributed under the [Odoo Community License (LGPL-3)](https://www.gnu.org/licenses/lgpl-3.0.html).
