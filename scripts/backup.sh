#!/bin/bash

set -e

DB_NAME=${1:-odoo}
BACKUP_DIR=./backups
DATE=$(date +%F_%H-%M-%S)

mkdir -p $BACKUP_DIR

echo "⏳ Waiting for PostgreSQL..."
docker compose exec db bash -c "until pg_isready -U odoo; do sleep 1; done"

echo "📦 Backing up database: $DB_NAME"
docker compose exec -T db pg_dump -U odoo -d $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

echo "📦 Backing up filestore..."
docker compose exec odoo tar -czf /tmp/filestore_$DATE.tar.gz -C /root/.local/share/Odoo/filestore $DB_NAME

echo "📤 Copying filestore to host..."
docker cp odoo_app:/tmp/filestore_$DATE.tar.gz $BACKUP_DIR/filestore_$DATE.tar.gz

echo "🧹 Cleaning temp files..."
docker compose exec odoo rm /tmp/filestore_$DATE.tar.gz

# ✅ Optional: maintain "latest" for restore.sh compatibility
cp $BACKUP_DIR/backup_$DATE.sql ./backup.sql
cp $BACKUP_DIR/filestore_$DATE.tar.gz ./filestore.tar.gz

echo "✅ Backup complete!"
echo "→ $BACKUP_DIR/backup_$DATE.sql"
echo "→ $BACKUP_DIR/filestore_$DATE.tar.gz"
echo "→ latest copies: backup.sql + filestore.tar.gz"