#!/bin/bash
# scripts/entrypoint.sh
set -e

DB_HOST="${HOST:-db}"
DB_PORT="${PORT:-5432}"
DB_USER="${USER:-odoo}"
DB_NAME="${DB:-odoo}"

# ── 1. Wait for Postgres to be reachable ──────────────────────────
echo "⏳  Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} ..."
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -q; do
    sleep 1
done
echo "✅  PostgreSQL is ready."

# ── 2. Detect an uninitialised database ───────────────────────────
# Checking for `ir_module_module` alone is not enough — the table is
# created at the very start of the init sequence, so the first probe
# passes even if the install never finished.  We go one step further
# and confirm that the `base` module is actually in state 'installed'.
#
# The query is wrapped in a DO block so a missing table (fresh DB)
# returns 'f' instead of causing a psql error.
IS_INITIALIZED=$(PGPASSWORD="${PASSWORD:-odoo}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -tAc "
        SELECT CASE
            WHEN EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name   = 'ir_module_module'
            )
            THEN (
                SELECT (state = 'installed')::text
                FROM   ir_module_module
                WHERE  name = 'base'
                LIMIT  1
            )
            ELSE 'f'
        END;
    " 2>/dev/null || echo "f")

if [ "${IS_INITIALIZED}" != "true" ]; then
    echo "🔧  Database not fully initialised — running first-time setup (this runs once)..."
    python3 /app/odoo-bin \
        --config=/etc/odoo/odoo.conf \
        -d "${DB_NAME}" \
        -i base \
        --without-demo \
        --workers=0 \
        --stop-after-init
    echo "✅  Schema initialised."
else
    echo "✅  Database already initialised — skipping init."
fi

# ── 3. Hand off to the main process (CMD) ─────────────────────────
exec "$@"
