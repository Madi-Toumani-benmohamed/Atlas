#!/bin/sh
set -eu
[ "${ATLAS_DATABASE_PASSWORD:?Set a distinct application password}" != "${POSTGRES_PASSWORD:-}" ] || { echo "Application and administrator passwords must differ" >&2; exit 1; }
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 --set=app_database="$POSTGRES_DB" --set=app_password="${ATLAS_DATABASE_PASSWORD:?Set a distinct application password}" <<'SQL'
CREATE ROLE atlas LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';
ALTER DATABASE :"app_database" OWNER TO atlas;
SQL
