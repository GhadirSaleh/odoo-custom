#!/bin/bash
set -euo pipefail

DB_NAME=${1:-odoo}
ARCHIVE=${2:-./backups/latest.tar.gz}
DB_USER=odoo

if [ ! -f "$ARCHIVE" ]; then
  echo "❌ Backup archive not found: $ARCHIVE"
  exit 1
fi

TMP_DIR="./restore_tmp"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

echo "📦 Extracting backup..."
tar -xzf "$ARCHIVE" -C "$TMP_DIR"

echo "⏳ Waiting for PostgreSQL..."
until docker compose exec -T db pg_isready -U "$DB_USER" >/dev/null 2>&1; do
  sleep 1
done

echo "🧹 Resetting database..."
docker compose exec -T db psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker compose exec -T db psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "📥 Restoring database..."
cat "$TMP_DIR/db.sql" | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME"

echo "📦 Restoring filestore..."
docker compose exec odoo rm -rf /var/lib/odoo/filestore/"$DB_NAME"
docker cp "$TMP_DIR/filestore/" "$(docker compose ps -q odoo):/var/lib/odoo/filestore/"

rm -rf "$TMP_DIR"

echo "🔁 Restarting Odoo..."
docker compose restart odoo

echo "✅ Restore complete"