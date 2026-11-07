#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${ATLAS_BACKUP_KEY_FILE:?Set the path to the private 32-byte archive key}"
: "${ATLAS_BACKUP_DIR:?Set a private backup directory}"
archive_bin=${ATLAS_ARCHIVE_BIN:-./bin/atlas-archive}
backup_database=${ATLAS_DATABASE_NAME:-atlas}
[[ "$backup_database" =~ ^[a-z0-9_]+$ ]] || { echo 'Invalid backup database name' >&2; exit 1; }
mkdir -p "$ATLAS_BACKUP_DIR"
backup_temp=$(mktemp -d "$ATLAS_BACKUP_DIR/.atlas-backup.XXXXXXXX")
trap 'rm -f "$backup_temp/dump.aesgcm"; rmdir "$backup_temp" 2>/dev/null || true' EXIT
backup_file="$(date -u +%Y%m%dT%H%M%SZ)-${backup_temp##*.}.aesgcm"
# pg_dump failure propagates through pipefail. Only completed pipelines publish a backup.
docker compose exec -T db pg_dump -U atlas -d "$backup_database" -Fc | "$archive_bin" encrypt -key-file "$ATLAS_BACKUP_KEY_FILE" -out "$backup_temp/dump.aesgcm"
"$archive_bin" verify -key-file "$ATLAS_BACKUP_KEY_FILE" < "$backup_temp/dump.aesgcm"
ln "$backup_temp/dump.aesgcm" "$ATLAS_BACKUP_DIR/$backup_file"
printf '%s\n' "$ATLAS_BACKUP_DIR/$backup_file"
