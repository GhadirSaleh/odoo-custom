#!/bin/bash
# scripts/entrypoint.sh
#
# Waits for the Postgres service to accept connections before handing off
# to the CMD.  This is a defence-in-depth layer on top of the healthcheck
# condition in docker-compose.yml.

set -e

DB_HOST="${HOST:-db}"
DB_PORT="${PORT:-5432}"
DB_USER="${USER:-odoo}"

echo "⏳  Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} ..."
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -q; do
    sleep 1
done
echo "✅  PostgreSQL is ready."

exec "$@"

