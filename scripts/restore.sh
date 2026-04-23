#!/bin/bash

set -e

DB_NAME=${1:-odoo}
BACKUP_FILE=backup.sql
FILESTORE_ARCHIVE=filestore.tar.gz

echo "⏳ Waiting for PostgreSQL..."
docker compose exec db bash -c "until pg_isready -U odoo; do sleep 1; done"

echo "🧹 Dropping existing DB (if exists)..."
docker compose exec db psql -U odoo -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo "🆕 Creating DB..."
docker compose exec db psql -U odoo -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "📥 Restoring database..."
cat $BACKUP_FILE | docker compose exec -T db psql -U odoo -d $DB_NAME

echo "📦 Restoring filestore..."
docker compose exec odoo mkdir -p /root/.local/share/Odoo/filestore/$DB_NAME
docker compose exec -T odoo tar -xzf - -C /root/.local/share/Odoo/filestore/ < $FILESTORE_ARCHIVE

echo "🔁 Restarting Odoo..."
docker compose restart odoo

echo "✅ Restore complete: http://localhost:8069"