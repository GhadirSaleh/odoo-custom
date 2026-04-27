#!/bin/bash

set -e

# Usage help
usage() {
    echo "Usage: $0 [DB_NAME] [BACKUP_FILE] [FILESTORE_ARCHIVE]"
    echo "  DB_NAME:           Name of the Odoo database (default: odoo)"
    echo "  BACKUP_FILE:       SQL file to restore (default: backup.sql)"
    echo "  FILESTORE_ARCHIVE: tar.gz filestore archive (default: filestore.tar.gz)"
}

DB_NAME=${1:-odoo}
BACKUP_FILE=${2:-backup.sql}
FILESTORE_ARCHIVE=${3:-filestore.tar.gz}

# Validate input files
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Database backup file '$BACKUP_FILE' not found!"
    usage
    exit 1
fi

if [ ! -f "$FILESTORE_ARCHIVE" ]; then
    echo "❌ Error: Filestore archive '$FILESTORE_ARCHIVE' not found!"
    usage
    exit 1
fi

echo "⏳ Waiting for PostgreSQL..."
docker compose exec db bash -c "until pg_isready -U odoo; do sleep 1; done"

echo "🧹 Dropping existing DB (if exists)..."
docker compose exec db psql -U odoo -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo "🆕 Creating DB..."
docker compose exec db psql -U odoo -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "📥 Restoring database..."
cat "$BACKUP_FILE" | docker compose exec -T db psql -U odoo -d "$DB_NAME"

echo "📦 Restoring filestore..."
docker compose exec odoo mkdir -p /root/.local/share/Odoo/filestore/"$DB_NAME"
docker compose exec -T odoo tar -xzf - -C /root/.local/share/Odoo/filestore/ < "$FILESTORE_ARCHIVE"

echo "🔁 Restarting Odoo..."
docker compose restart odoo

echo "✅ Restore complete: http://localhost:8069"