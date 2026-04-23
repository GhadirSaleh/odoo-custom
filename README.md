# odoo-custom

A customizable Odoo Docker deployment with key add-ons for accounting, custom POS layout, and a modern MUK theme.

---

## Features

- **Accounting Add-on**  
  Odoo’s powerful, modular accounting suite.
- **POS (Point of Sale) — Custom Layout**  
  Enhanced Point of Sale with customizations in `pos_ghadir`.
- **MUK Theme**  
  Modern, responsive interface from the Muk theme add-on.

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

---

### 1. Initialize (First Time Setup)

```sh
docker compose up --build
```
Builds images and starts the containers from scratch.

---

### 2. Start (Normal Use)

```sh
docker compose up
```
Starts the containers using existing images.

---

### 3. Soft Stop (Preserve Data)

```sh
docker compose down
```
Stops and removes containers, but **persists data volumes** so your data is safe.

---

### 4. Stop and Delete Volumes (Full Cleanup)

```sh
docker compose down -v
```
Stops containers and **deletes all associated data volumes** (irreversible data removal).

---

## Database example (test-db-backup-web-restore)

test.....zip

Restore this DB from the web UI after the initialization into a DB named `odoo` for the cleanest experience.

---

## Add-ons

- **account:** Odoo core accounting add-on.
- **pos_ghadir:** Custom POS layout with domain-specific POS customizations.  
- **theme_muk:** MUK community theme for a better user interface.

---

## Tips

- Use `-v` with `docker compose down` only if you wish to remove all data and start fresh.
- Use `--build` only after changes to the Dockerfile or dependencies.

---

## License

Distributed under the Odoo Community License.