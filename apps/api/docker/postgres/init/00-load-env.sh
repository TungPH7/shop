#!/bin/bash
# =====================================================================
# Init script — tạo app role, schema, extensions cho PostgreSQL.
# Chạy LẦN ĐẦU khi container init (data folder rỗng).
# =====================================================================
set -euo pipefail

: "${APP_DB_USER:?APP_DB_USER must be set}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set}"
: "${APP_DB_NAME:?APP_DB_NAME must be set}"

echo "==================================================================="
echo "[init] Setting up app role: $APP_DB_USER on database $APP_DB_NAME"
echo "==================================================================="

psql --username "$POSTGRES_USER" --dbname "$APP_DB_NAME" \
     --set ON_ERROR_STOP=on <<-EOSQL

    -- 1. App role
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${APP_DB_USER}') THEN
            CREATE ROLE "${APP_DB_USER}" WITH LOGIN PASSWORD '${APP_DB_PASSWORD}';
            RAISE NOTICE 'Created role: ${APP_DB_USER}';
        ELSE
            RAISE NOTICE 'Role ${APP_DB_USER} already exists, skip create';
        END IF;
    END
    \$\$;

    GRANT CONNECT ON DATABASE "${APP_DB_NAME}" TO "${APP_DB_USER}";
    GRANT CREATE ON DATABASE "${APP_DB_NAME}" TO "${APP_DB_USER}";

    -- 2. Extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "citext";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";

    -- 3. Schema 'app' với owner là app role
    CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION "${APP_DB_USER}";
    GRANT USAGE, CREATE ON SCHEMA app TO "${APP_DB_USER}";

    ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON TABLES TO "${APP_DB_USER}";
    ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON SEQUENCES TO "${APP_DB_USER}";

    -- 4. Search path
    ALTER ROLE "${APP_DB_USER}" SET search_path TO app, public;

    -- Done
    SELECT 'Init completed for ${APP_DB_USER} @ ${APP_DB_NAME}' AS status;

EOSQL

echo "[init] Done."