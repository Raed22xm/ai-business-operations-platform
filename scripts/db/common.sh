#!/usr/bin/env bash
# Shared helpers for AiBusiness PostgreSQL backup/restore.
# Never echo passwords or full connection strings.

set -euo pipefail

FORBIDDEN_DATABASE="${AIBUSINESS_FORBIDDEN_DATABASE:-aibusiness_customers_dev}"
DEFAULT_CONTAINER="${AIBUSINESS_PG_CONTAINER:-aibusiness-customers-postgres}"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

redact_conn() {
  # Replace Password=... segments for any accidental logging.
  printf '%s' "$1" | sed -E 's/(Password|Pwd)=[^;]*/\1=***/Ig'
}

backup_dir() {
  if [[ -n "${AIBUSINESS_BACKUP_DIR:-}" ]]; then
    printf '%s' "$AIBUSINESS_BACKUP_DIR"
    return
  fi
  case "$(uname -s)" in
    Darwin)
      printf '%s/Library/Application Support/AiBusiness/backups' "$HOME"
      ;;
    *)
      printf '%s/.local/share/aibusiness/backups' "${XDG_DATA_HOME:-$HOME/.local/share}"
      ;;
  esac
}

ensure_backup_dir() {
  local dir
  dir="$(backup_dir)"
  mkdir -p "$dir"
  chmod 700 "$dir" 2>/dev/null || true
  printf '%s' "$dir"
}

# Parse Npgsql-style connection string into PG* exports (no printing).
# Sets: PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD AIBUSINESS_CONN_SOURCE
parse_connection_string() {
  local conn="$1"
  [[ -n "$conn" ]] || die "Empty connection string."

  local host="localhost" port="5432" user="" db="" password=""
  local IFS=';'
  local part key value
  for part in $conn; do
    key="${part%%=*}"
    value="${part#*=}"
    case "$(printf '%s' "$key" | tr '[:upper:]' '[:lower:]')" in
      host|server) host="$value" ;;
      port) port="$value" ;;
      database|db) db="$value" ;;
      username|user|userid|uid) user="$value" ;;
      password|pwd) password="$value" ;;
    esac
  done

  [[ -n "$db" ]] || die "Connection string must include Database=..."
  [[ -n "$user" ]] || die "Connection string must include Username=..."

  export PGHOST="$host"
  export PGPORT="$port"
  export PGUSER="$user"
  export PGDATABASE="$db"
  export PGPASSWORD="$password"
}

load_connection() {
  # Priority: --connection arg already applied by caller via AIBUSINESS_CONNECTION
  # then env ConnectionStrings__DefaultConnection / AIBUSINESS_DATABASE_URL
  # then --from-user-secrets
  local conn="${AIBUSINESS_CONNECTION:-}"
  if [[ -z "$conn" ]]; then
    conn="${ConnectionStrings__DefaultConnection:-}"
  fi
  if [[ -z "$conn" ]]; then
    conn="${AIBUSINESS_DATABASE_URL:-}"
  fi
  if [[ -z "$conn" && "${AIBUSINESS_FROM_USER_SECRETS:-}" == "1" ]]; then
    local project root
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    project="$root/backend/src/AiBusiness.Api"
    command -v dotnet >/dev/null 2>&1 || command -v "$HOME/.dotnet/dotnet" >/dev/null 2>&1 || \
      die "dotnet not found; set ConnectionStrings__DefaultConnection or install the .NET SDK."
    local dotnet_bin
    if command -v dotnet >/dev/null 2>&1; then
      dotnet_bin="dotnet"
    else
      dotnet_bin="$HOME/.dotnet/dotnet"
    fi
    # Capture only; never print the raw list.
    local list
    list="$("$dotnet_bin" user-secrets list --project "$project" 2>/dev/null || true)"
    conn="$(printf '%s\n' "$list" | awk -F' = ' '
      tolower($1) ~ /^connectionstrings:defaultconnection$/ { print substr($0, index($0, " = ") + 3); exit }
    ')"
    [[ -n "$conn" ]] || die "Could not read ConnectionStrings:DefaultConnection from user-secrets."
  fi
  [[ -n "$conn" ]] || die "Provide a connection string via ConnectionStrings__DefaultConnection, AIBUSINESS_DATABASE_URL, --connection, or --from-user-secrets."
  parse_connection_string "$conn"
}

assert_not_forbidden_database() {
  local name="$1"
  local reason="${2:-operation}"
  if [[ "$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')" == "$(printf '%s' "$FORBIDDEN_DATABASE" | tr '[:upper:]' '[:lower:]')" ]]; then
    die "Refusing to $reason the development database '${FORBIDDEN_DATABASE}'."
  fi
  if [[ -z "$name" ]]; then
    die "Database name is required for $reason."
  fi
}

# Prefer tools inside the known Docker container when the host has no pg_dump
# or when targeting the local AIBusiness Postgres container.
use_docker_pg() {
  if [[ "${AIBUSINESS_FORCE_DOCKER:-}" == "1" ]]; then
    return 0
  fi
  if [[ "${AIBUSINESS_FORCE_HOST_PG:-}" == "1" ]]; then
    return 1
  fi
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi
  if ! docker inspect "$DEFAULT_CONTAINER" >/dev/null 2>&1; then
    return 1
  fi
  # Same host/port as the dedicated local container, or missing host client tools.
  if [[ "$PGHOST" == "127.0.0.1" || "$PGHOST" == "localhost" ]] && [[ "$PGPORT" == "5434" ]]; then
    return 0
  fi
  if ! command -v pg_dump >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

run_psql() {
  local db="${1:-$PGDATABASE}"
  shift || true
  if use_docker_pg; then
    # Local socket auth inside the container does not need PGPASSWORD.
    docker exec -i "$DEFAULT_CONTAINER" \
      psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$db" "$@"
  else
    psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" "$@"
  fi
}

run_pg_dump() {
  # Args after options are passed to pg_dump; stdout is the dump stream.
  if use_docker_pg; then
    docker exec -i "$DEFAULT_CONTAINER" \
      pg_dump -U "$PGUSER" -d "$PGDATABASE" "$@"
  else
    pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" "$@"
  fi
}

run_pg_restore() {
  local db="$1"
  shift
  if use_docker_pg; then
    docker exec -i "$DEFAULT_CONTAINER" \
      pg_restore -U "$PGUSER" -d "$db" "$@"
  else
    pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" "$@"
  fi
}

database_exists() {
  local name="$1"
  local found
  found="$(run_psql postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${name//\'/\'\'}'" | tr -d '[:space:]')"
  [[ "$found" == "1" ]]
}

create_database() {
  local name="$1"
  assert_not_forbidden_database "$name" "create"
  if database_exists "$name"; then
    die "Destination database '$name' already exists. Choose a new name or drop the disposable DB first."
  fi
  run_psql postgres -c "CREATE DATABASE \"${name//\"/\"\"}\" OWNER \"${PGUSER//\"/\"\"}\";" >/dev/null
}

drop_database_if_requested() {
  local name="$1"
  assert_not_forbidden_database "$name" "drop"
  run_psql postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${name//\'/\'\'}' AND pid <> pg_backend_pid();" >/dev/null || true
  run_psql postgres -c "DROP DATABASE IF EXISTS \"${name//\"/\"\"}\";" >/dev/null
}

count_table() {
  local db="$1"
  local table="$2"
  run_psql "$db" -tAc "SELECT count(*) FROM \"${table}\";" | tr -d '[:space:]'
}

relationship_orphans() {
  local db="$1"
  local cases_without_customer tasks_without_case notes_without_customer
  cases_without_customer="$(run_psql "$db" -tAc \
    'SELECT count(*) FROM "Cases" c LEFT JOIN "Customers" cu ON cu."Id" = c."CustomerId" WHERE cu."Id" IS NULL;' | tr -d '[:space:]')"
  tasks_without_case="$(run_psql "$db" -tAc \
    'SELECT count(*) FROM "CaseTasks" t LEFT JOIN "Cases" c ON c."Id" = t."CaseId" WHERE c."Id" IS NULL;' | tr -d '[:space:]')"
  notes_without_customer="$(run_psql "$db" -tAc \
    'SELECT count(*) FROM "CustomerNotes" n LEFT JOIN "Customers" cu ON cu."Id" = n."CustomerId" WHERE cu."Id" IS NULL;' | tr -d '[:space:]')"
  printf '%s %s %s' "$cases_without_customer" "$tasks_without_case" "$notes_without_customer"
}

print_safe_target_summary() {
  printf 'host=%s port=%s database=%s user=%s\n' "$PGHOST" "$PGPORT" "$PGDATABASE" "$PGUSER"
}
