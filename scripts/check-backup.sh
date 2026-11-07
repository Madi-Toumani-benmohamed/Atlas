#!/usr/bin/env bash
# Check ciphertext authentication and filesystem age, without producing a dump.
set -euo pipefail
: "${ATLAS_BACKUP_KEY_FILE:?Set the private archive key path}"
: "${ATLAS_BACKUP_MAX_AGE_SECONDS:?Choose an explicit maximum file age in seconds}"
[[ $# -eq 1 ]] || { echo 'Usage: check-backup.sh ARCHIVE.aesgcm' >&2; exit 1; }
[[ "$ATLAS_BACKUP_MAX_AGE_SECONDS" =~ ^[1-9][0-9]{0,8}$ ]] || { echo 'Invalid maximum age' >&2; exit 1; }
[[ -f "$1" && ! -L "$1" ]] || { echo 'Expected a regular archive, not a symbolic link' >&2; exit 1; }
archive_mode=$(stat -c %a -- "$1" 2>/dev/null) || { echo 'Cannot inspect archive permissions' >&2; exit 1; }
[[ "$archive_mode" =~ ^[0-7]{3,4}$ ]] && (( (8#$archive_mode & 077) == 0 )) || { echo 'Archive must not be group/world accessible' >&2; exit 1; }
modified=$(stat -c %Y -- "$1" 2>/dev/null) || { echo 'Cannot inspect archive age' >&2; exit 1; }
[[ "$modified" =~ ^[0-9]{1,12}$ ]] || { echo 'Invalid archive modification time' >&2; exit 1; }
now=$(date -u +%s)
(( modified <= now )) || { echo 'Archive modification time is in the future' >&2; exit 1; }
(( now - modified <= ATLAS_BACKUP_MAX_AGE_SECONDS )) || { echo 'Archive exceeds the chosen maximum file age' >&2; exit 1; }
archive_bin=${ATLAS_ARCHIVE_BIN:-./bin/atlas-archive}
"$archive_bin" verify -key-file "$ATLAS_BACKUP_KEY_FILE" < "$1"
printf '%s\n' 'Archive authenticated; filesystem age is within the chosen threshold. Restore verification remains separate.'
