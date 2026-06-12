# Odoo Server Setup Documentation

## Overview

Single-server Odoo deployment with Docker Compose, fronted by nginx on the host with HTTPS via Let's Encrypt, and DDNS via No-IP.

### Architecture

```
Internet
  │
  │  halanuts.ddns.net  →  82.137.203.114
  │
  ▼
┌──────────────────────────────────────────┐
│  Host Machine                            │
│  ┌────────────────────────────────────┐  │
│  │  nginx (on host)                  │  │
│  │  Port 80  → redirect to 443       │  │
│  │  Port 443 → SSL termination       │  │
│  │  ┌──────────────────────────┐    │  │
│  │  │ LAN: 192.168.1.16       │    │  │
│  │  │ WAN: 82.137.203.114     │    │  │
│  │  └──────────────────────────┘    │  │
│  └──────────────┬───────────────────┘  │
│                 │ proxy_pass            │
│  ┌──────────────▼───────────────────┐  │
│  │  Docker Compose                 │  │
│  │  ┌──────────┐  ┌──────────────┐ │  │
│  │  │ Odoo 19  │  │ PostgreSQL   │ │  │
│  │  │ :8069    │  │ 15-alpine    │ │  │
│  │  │ :8072    │  │ :5432        │ │  │
│  │  └──────────┘  └──────────────┘ │  │
│  └─────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Network Details

| Interface | Address | Notes |
|---|---|---|
| LAN | `192.168.1.16` | Local access, self-signed SSL |
| WAN | `82.137.203.114` | STE (Syrian Telecom) static IP |
| Domain | `halanuts.ddns.net` | No-IP DDNS pointing to `82.137.203.114` |

### Ports

| Port | Service | Purpose |
|---|---|---|
| 80 | nginx (host) | HTTP → HTTPS redirect |
| 443 | nginx (host) | HTTPS, proxies to Odoo |
| 8069 | Odoo (Docker) | Odoo web + API |
| 8072 | Odoo (Docker) | Longpolling / websocket |
| 5432 | PostgreSQL (Docker) | Database (internal only) |

---

## Host Setup

### OS

The host runs Debian 12 (bookworm) — verified with `cat /etc/os-release`.
Docker Engine was installed via the official convenience script at `get.docker.com`.

### Nginx

- **Configuration**: `/etc/nginx/sites-available/odoo` (copy deployed from `config/odoo-nginx-config`)
- **Self-signed cert** for LAN: `/etc/nginx/ssl/192.168.1.16.pem`
- **Let's Encrypt cert** for DDNS: `/etc/letsencrypt/live/halanuts.ddns.net/`
- SSL settings: `/etc/letsencrypt/options-ssl-nginx.conf`, `/etc/letsencrypt/ssl-dhparams.pem`

### Let's Encrypt (certbot)

#### Initial Setup

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d halanuts.ddns.net
```

#### Automatic Renewal

Certificates expire every 90 days. Certbot auto-renews when <30 days remain.

Set up a cron job to run renewal:

```bash
sudo crontab -e
```

Add this line (runs daily at 3 AM):

```
0 3 * * * /usr/bin/certbot renew --quiet --nginx && systemctl reload nginx
```

#### Test Renewal

```bash
sudo certbot renew --dry-run
```

#### Manual Renewal (if needed)

```bash
sudo certbot renew --nginx
sudo systemctl reload nginx
```

### No-IP DDNS

- **Domain**: `halanuts.ddns.net`
- **Points to**: `82.137.203.114`
- **Provider**: No-IP (free)
- **Client**: No-IP DUC (or router DDNS client) keeps the A record updated

---

## Docker Stack

### Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Production baseline (image, read-only mounts, `command: odoo --config=/etc/odoo/odoo.conf`) |
| `docker-compose.override.yml` | Dev overrides (writable mounts, `command: odoo --config=/etc/odoo/odoo.conf --dev=all`) |
| `config/odoo.conf` | Odoo configuration |
| `config/odoo-nginx-config` | Nginx server blocks (copy to host) |
| `.env` | Secrets (gitignored, copy from `.env.example`) |
| `scripts/custom-entrypoint.sh` | One-shot DB init wrapper |

### Services

1. **PostgreSQL 15-Alpine** — database
2. **Odoo 19** — application server with `--proxy-mode`

### Addons (`addons/`)

**Custom:**
- `pos_ghadir` — POS multi-currency, stock alerts, receipt UI (`auto_install: True`)

**Third-party suites:**
- `muk_web_*` (7 modules) — UI theme framework
- `om_account_*`, `om_fiscal_year`, `om_recurring_payments` (7 modules) — Accounting suite
- `bi_pos_default_customer` — Default customer for POS
- `accounting_pdf_reports` — PDF reports

### Commands

All commands run from the project root (`/home/hermanus/odoo-custom`):

| Task | Command |
|---|---|
| Start | `docker compose up` |
| Start (detached) | `docker compose up -d` |
| Stop | `docker compose down` |
| Shell into Odoo | `docker compose exec odoo bash` |
| Update module | `docker compose exec odoo odoo -c /etc/odoo/odoo.conf --db_host=db --db_user=odoo --db_password=odoo -d odoo -u <module> --stop-after-init --workers=0 --http-port=8067` |
| Run tests | `docker compose exec odoo odoo -c /etc/odoo/odoo.conf --db_host=db --db_user=odoo --db_password=odoo -d odoo -u <module> --test-enable --stop-after-init --workers=0 --http-port=8067` |
| View logs | `docker compose logs -f odoo` |
| Wipe everything | `docker compose down -v` |
| Connect to DB | `docker compose exec db psql -U odoo odoo` |

### First-time Setup

The DB is auto-initialised by `scripts/custom-entrypoint.sh` on first `docker compose up`. It runs `-i base --without-demo --workers=0 --stop-after-init` once, then skips re-init on subsequent starts.

Force re-init: `docker compose down -v`

---

## Rebuild from Scratch

If the server dies and you need to rebuild:

1. **Install OS + Docker**: Docker Engine + Docker Compose v2
2. **Clone repo**: `git clone <repo-url>`
3. **Set up .env**: `cp .env.example .env`, edit `POSTGRES_PASSWORD`
4. **Set up nginx**:
   - Install nginx: `sudo apt install nginx`
   - Copy `config/odoo-nginx-config` to `/etc/nginx/sites-available/odoo`
   - Enable it: `sudo ln -s /etc/nginx/sites-available/odoo /etc/nginx/sites-enabled/`
   - Create self-signed cert for LAN: `sudo mkdir -p /etc/nginx/ssl && sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout /etc/nginx/ssl/192.168.1.16-key.pem -out /etc/nginx/ssl/192.168.1.16.pem`
   - Test: `sudo nginx -t && sudo systemctl reload nginx`
5. **Set up certbot**:
   - `sudo apt install certbot python3-certbot-nginx`
   - `sudo certbot --nginx -d halanuts.ddns.net`
   - Set up cron job (see Let's Encrypt section above)
6. **Start Docker**: `docker compose up -d`
7. **Set up No-IP**: Install DUC client, point `halanuts.ddns.net` to your new public IP

---

## Known Issues

- **Syriatel mobile (AS48065)** cannot reach `82.137.203.114` — traffic is routed via Cyta (Cyprus) and dropped. Workaround: VPN or Cloudflare Tunnel.
- **No automated backup** is currently configured (use Odoo DB manager at `/web/database/manager`).
