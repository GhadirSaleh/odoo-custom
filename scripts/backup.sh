#!/bin/bash
set -euo pipefail

DB_NAME=${1:-odoo}
DB_USER=odoo
BACKUP_DIR=./backups
DATE=$(date +%F_%H-%M-%S)

mkdir -p "$BACKUP_DIR"

echo "⏳ Waiting for PostgreSQL..."
until docker compose exec -T db pg_isready -U "$DB_USER" >/dev/null 2>&1; do
  sleep 1
done

TMP_DIR="$BACKUP_DIR/tmp_$DATE"
mkdir -p "$TMP_DIR"

echo "📦 Dumping database..."
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges > "$TMP_DIR/db.sql"

echo "📦 Copying filestore..."
docker cp "$(docker compose ps -q odoo):/var/lib/odoo/filestore/$DB_NAME" \
  "$TMP_DIR/filestore"

echo "📦 Creating archive..."
tar -czf "$BACKUP_DIR/odoo_backup_$DATE.tar.gz" -C "$TMP_DIR" .

rm -rf "$TMP_DIR"

# latest pointer
cp "$BACKUP_DIR/odoo_backup_$DATE.tar.gz" "$BACKUP_DIR/latest.tar.gz"

echo "✅ Backup complete:"
echo "$BACKUP_DIR/odoo_backup_$DATE.tar.gz"