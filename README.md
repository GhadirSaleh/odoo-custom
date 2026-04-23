# odoo-custom Project Initialization and Management

## Initialize (Build and Start for the First Time)
```
docker compose up --build
```
This will build the images and start the containers.

## Database example (test-db-backup-web-restore)
test.....zip
Restore this DB from web UI after the initialization into a DB named odoo for the cleanest experience.

## Xlsx file is extra for reference.

## Start (Subsequent Runs)
```
docker compose up
```
Starts the containers using the existing images.

## Soft Stop (Container Stop, Data Persisted)
```
docker compose down
```
Stops and removes containers, but persists volumes (data is saved).

## Stop and Delete Volumes (Full Cleanup)
```
docker compose down -v
```
Stops containers and deletes all associated volumes (data is removed).

---

- Use `-v` when you want to remove all data and start fresh.
- Only use `--build` if you've made changes to the Dockerfile or dependencies.
- For more options, consult the [Docker Compose documentation](https://docs.docker.com/compose/reference/).

---
