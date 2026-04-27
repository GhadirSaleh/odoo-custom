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

echo "📦 Backing up database: $DB_NAME"
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges > "$BACKUP_DIR/backup_$DATE.sql"

echo "📦 Backing up filestore..."
# adjust path if needed
FILESTORE_PATH="/root/.local/share/Odoo/filestore/$DB_NAME"

docker cp "$(docker compose ps -q odoo):$FILESTORE_PATH" \
  "$BACKUP_DIR/filestore_$DATE"

tar -czf "$BACKUP_DIR/filestore_$DATE.tar.gz" -C "$BACKUP_DIR" "filestore_$DATE"
rm -rf "$BACKUP_DIR/filestore_$DATE"

# latest copies
cp "$BACKUP_DIR/backup_$DATE.sql" ./backup.sql
cp "$BACKUP_DIR/filestore_$DATE.tar.gz" ./filestore.tar.gz

echo "✅ Backup complete!"
echo "→ $BACKUP_DIR/backup_$DATE.sql"
echo "→ $BACKUP_DIR/filestore_$DATE.tar.gz"