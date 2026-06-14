#!/bin/sh
set -e

BACKUP_DIR=/backups
DB_PATH=/app/db.sqlite3
KEEP=7

mkdir -p "$BACKUP_DIR"
if [ -f "$DB_PATH" ]; then
    TS=$(date -u +"%F_%H%M%S")
    cp "$DB_PATH" "$BACKUP_DIR/db_${TS}.sqlite3"
    # rotation : garder les $KEEP plus récents
    ls -1t "$BACKUP_DIR"/db_*.sqlite3 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm --
fi