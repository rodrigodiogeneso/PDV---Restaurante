#!/bin/bash
# Backup do SQLite via .backup (seguro mesmo durante escrita, graças ao WAL).
# Uso: adicione ao crontab do servidor:
#   0 */6 * * * /opt/pdv-restaurante/deploy/backup.sh
# (a cada 6 horas; ajuste conforme a frequência desejada)

DB_PATH="${DB_PATH:-/opt/pdv-restaurante/backend/db/pdv.db}"
BACKUP_DIR="${BACKUP_DIR:-/opt/pdv-restaurante/backups}"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEST="$BACKUP_DIR/pdv_${TIMESTAMP}.db"

sqlite3 "$DB_PATH" ".backup '$DEST'"

if [ $? -eq 0 ]; then
  gzip "$DEST"
  echo "[$(date)] Backup criado: ${DEST}.gz"
else
  echo "[$(date)] ERRO ao criar backup" >&2
  exit 1
fi

# Remove backups mais antigos que RETENTION_DAYS
find "$BACKUP_DIR" -name "pdv_*.db.gz" -mtime +$RETENTION_DAYS -delete
