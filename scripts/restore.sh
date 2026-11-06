#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${ATLAS_BACKUP_KEY_FILE:?Set the private archive key path}"
: "${ATLAS_RESTORE_DATABASE:?Choose a NEW database named atlas_restore_...}"
[[ "$ATLAS_RESTORE_DATABASE" =~ ^atlas_restore_[a-z0-9_]+$ ]] || { echo 'Refusing a non-restore database name' >&2; exit 1; }
[[ $# -eq 1 ]] || { echo 'Usage: restore.sh BACKUP.aesgcm' >&2; exit 1; }
archive_bin=${ATLAS_ARCHIVE_BIN:-./bin/atlas-archive}
restore_temp=$(mktemp -d)
trap 'rm -f "$restore_temp/verified.dump"; rmdir "$restore_temp"' EXIT
# Authenticate the entire archive before any database creation or restore.
"$archive_bin" decrypt -key-file "$ATLAS_BACKUP_KEY_FILE" -out "$restore_temp/verified.dump" < "$1"
# createdb refuses an existing database: no overwrite, DROP, or volume deletion.
docker compose exec -T db createdb -U postgres -O atlas "$ATLAS_RESTORE_DATABASE"
docker compose exec -T db pg_restore -U atlas --single-transaction --exit-on-error --no-owner --no-privileges -d "$ATLAS_RESTORE_DATABASE" < "$restore_temp/verified.dump"
printf 'Restored to %s. Verify it before changing DATABASE_URL.\n' "$ATLAS_RESTORE_DATABASE"
