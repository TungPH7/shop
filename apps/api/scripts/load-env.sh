#!/usr/bin/env bash
# Load .env vào shell rồi exec command.
# Usage:  ./scripts/load-env.sh ./mvnw spring-boot:run
#         ./scripts/load-env.sh java -jar target/learn-postgresql-api-*.jar

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found. Copy from .env.example first." >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

exec "$@"