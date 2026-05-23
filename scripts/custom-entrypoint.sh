#!/bin/bash
# scripts/custom-entrypoint.sh
#
# Wrapper that adds one-shot DB initialization on top of the official
# odoo:19 entrypoint.  After any needed init, it hands off to the
# image's built-in /entrypoint.sh which handles DB args and runs Odoo.
set -e

DB_HOST="${HOST:-db}"
DB_PORT="${PORT:-5432}"
DB_USER="${USER:-odoo}"
DB_PASSWORD="${PASSWORD:-odoo}"
DB_NAME="${DB:-odoo}"

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} ..."
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -q; do
    sleep 1
done
echo "PostgreSQL is ready."

# Ensure config is writable (for saving admin password changes via UI)
chmod o+w /etc/odoo /etc/odoo/odoo.conf 2>/dev/null || true

IS_INITIALIZED=$(PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    -tAc "
        SELECT CASE
            WHEN EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'ir_module_module'
            )
            THEN (SELECT (state = 'installed')::text FROM ir_module_module WHERE name = 'base' LIMIT 1)
            ELSE 'f'
        END;
    " 2>/dev/null || echo "f")

if [ "${IS_INITIALIZED}" != "true" ]; then
    echo "Database not fully initialised — running first-time setup (this runs once)..."
    odoo \
        -c /etc/odoo/odoo.conf \
        -d "${DB_NAME}" \
        -i base \
        --without-demo \
        --workers=0 \
        --stop-after-init \
        --db_host "${DB_HOST}" \
        --db_port "${DB_PORT}" \
        --db_user "${DB_USER}" \
        --db_password "${DB_PASSWORD}"
    echo "Schema initialised."
else
    echo "Database already initialised — skipping init."
fi

exec /entrypoint.sh "$@"
