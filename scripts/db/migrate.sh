#!/usr/bin/env bash
# Database migration and schema rollback helper for AiBusiness.
# Uses dotnet ef under the hood; never prints passwords or connection secrets.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_PROJECT="$ROOT_DIR/backend/src/AiBusiness.Api"

# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/db/migrate.sh [command] [options]

Commands:
  --status                List all migrations and show applied/pending status.
  --apply                 Apply all pending migrations to the database.
  --rollback <migration>  Roll back migrations down to the specified target migration.
                          Use '0' to revert all migrations.
  --script [output_path]  Generate an idempotent SQL script of all migrations.
                          If output_path is omitted, outputs to stdout.

Options:
  --from-user-secrets     Read connection string from backend API user-secrets.
  --connection <str>      Npgsql connection string (prefer env vars in production).
  -h, --help              Show this help.

Environment:
  ConnectionStrings__DefaultConnection / AIBUSINESS_DATABASE_URL
  DOTNET_ROOT (optional path to .NET SDK directory)
EOF
}

export PATH="$HOME/.dotnet/tools:$HOME/.dotnet:$PATH"
if [[ -d "$HOME/.dotnet" && -z "${DOTNET_ROOT:-}" ]]; then
  export DOTNET_ROOT="$HOME/.dotnet"
fi

find_dotnet() {
  if [[ -x "${DOTNET_ROOT:-}/dotnet" ]]; then
    printf '%s/dotnet' "$DOTNET_ROOT"
    return
  fi
  if command -v dotnet >/dev/null 2>&1; then
    printf 'dotnet'
    return
  fi
  if [[ -x "$HOME/.dotnet/dotnet" ]]; then
    printf '%s/.dotnet/dotnet' "$HOME"
    return
  fi
  die ".NET SDK (dotnet) not found. Install .NET 10 or set DOTNET_ROOT."
}

DOTNET_BIN="$(find_dotnet)"
AIBUSINESS_FROM_USER_SECRETS="${AIBUSINESS_FROM_USER_SECRETS:-0}"
COMMAND=""
TARGET_MIGRATION=""
SCRIPT_OUTPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --status)
      COMMAND="status"
      shift
      ;;
    --apply)
      COMMAND="apply"
      shift
      ;;
    --rollback)
      COMMAND="rollback"
      [[ $# -ge 2 ]] || die "--rollback requires a target migration name (or '0' to revert all)."
      TARGET_MIGRATION="$2"
      shift 2
      ;;
    --script)
      COMMAND="script"
      if [[ $# -ge 2 && "$2" != --* ]]; then
        SCRIPT_OUTPUT="$2"
        shift 2
      else
        shift
      fi
      ;;
    --from-user-secrets)
      AIBUSINESS_FROM_USER_SECRETS=1
      shift
      ;;
    --connection)
      [[ $# -ge 2 ]] || die "--connection requires a value"
      AIBUSINESS_CONNECTION="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ -n "$COMMAND" ]] || { usage; exit 1; }

# Load connection string (sets PG* variables and extracts conn string)
export AIBUSINESS_FROM_USER_SECRETS
export AIBUSINESS_CONNECTION="${AIBUSINESS_CONNECTION:-}"

# For commands that talk to database, load connection
if [[ "$COMMAND" != "script" ]]; then
  load_connection
  CONN_STR="${AIBUSINESS_CONNECTION:-${ConnectionStrings__DefaultConnection:-${AIBUSINESS_DATABASE_URL:-}}}"
  if [[ -z "$CONN_STR" && "$AIBUSINESS_FROM_USER_SECRETS" == "1" ]]; then
    list="$("$DOTNET_BIN" user-secrets list --project "$API_PROJECT" 2>/dev/null || true)"
    CONN_STR="$(printf '%s\n' "$list" | awk -F' = ' '
      tolower($1) ~ /^connectionstrings:defaultconnection$/ { print substr($0, index($0, " = ") + 3); exit }
    ')"
  fi
  [[ -n "$CONN_STR" ]] || die "No connection string found. Provide via ConnectionStrings__DefaultConnection or --from-user-secrets."
fi

case "$COMMAND" in
  status)
    printf 'Checking migrations for database=%s (server=%s:%s)...\n' "$PGDATABASE" "$PGHOST" "$PGPORT"
    "$DOTNET_BIN" ef migrations list \
      --project "$API_PROJECT" \
      --connection "$CONN_STR" \
      --no-color
    ;;

  apply)
    printf 'Applying pending migrations to database=%s (server=%s:%s)...\n' "$PGDATABASE" "$PGHOST" "$PGPORT"
    "$DOTNET_BIN" ef database update \
      --project "$API_PROJECT" \
      --connection "$CONN_STR" \
      --no-color
    printf 'Migrations applied successfully.\n'
    ;;

  rollback)
    printf 'WARNING: Rolling back migrations on database=%s to target="%s"...\n' "$PGDATABASE" "$TARGET_MIGRATION"
    "$DOTNET_BIN" ef database update "$TARGET_MIGRATION" \
      --project "$API_PROJECT" \
      --connection "$CONN_STR" \
      --no-color
    printf 'Rollback to "%s" completed.\n' "$TARGET_MIGRATION"
    ;;

  script)
    if [[ -n "$SCRIPT_OUTPUT" ]]; then
      printf 'Generating idempotent SQL migration script to %s...\n' "$SCRIPT_OUTPUT"
      "$DOTNET_BIN" ef migrations script --idempotent \
        --project "$API_PROJECT" \
        --output "$SCRIPT_OUTPUT" \
        --no-color
      printf 'Script generated: %s\n' "$SCRIPT_OUTPUT"
    else
      "$DOTNET_BIN" ef migrations script --idempotent \
        --project "$API_PROJECT" \
        --no-color
    fi
    ;;
esac
