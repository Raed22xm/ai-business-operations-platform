#!/usr/bin/env bash
# Safe restore of an AiBusiness pg_dump into a NEW disposable database only.
# Refuses to overwrite the development database (aibusiness_customers_dev).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/db/restore.sh --dump <path> [options]

Restores a pg_dump custom-format file into a NEW database on the same server
as the connection string. Never targets the development database.

Options:
  --dump <path>           Backup file from scripts/db/backup.sh (required)
  --destination <name>    New database name (default: aibusiness_restore_YYYYMMDDTHHMMSSZ)
  --from-user-secrets     Read admin/server connection from API user-secrets
  --connection <str>      Npgsql connection string (Database= is the SOURCE server;
                          restore always uses a different destination name)
  --verify-only           After restore, print counts/orphan checks then exit
  --cleanup               Drop the destination database after a successful verify
  -h, --help              Show this help

Safety:
  - Destination defaults to a new disposable name.
  - Refuses destination aibusiness_customers_dev (and empty names).
  - Refuses if the destination already exists.
  - Leaves the original (source) database unchanged.

Environment: same as backup.sh (ConnectionStrings__DefaultConnection, etc.)
EOF
}

AIBUSINESS_FROM_USER_SECRETS="${AIBUSINESS_FROM_USER_SECRETS:-0}"
DUMP_PATH=""
DEST_NAME=""
VERIFY_ONLY=0
CLEANUP=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump)
      [[ $# -ge 2 ]] || die "--dump requires a path"
      DUMP_PATH="$2"
      shift 2
      ;;
    --destination)
      [[ $# -ge 2 ]] || die "--destination requires a name"
      DEST_NAME="$2"
      shift 2
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
    --verify-only)
      VERIFY_ONLY=1
      shift
      ;;
    --cleanup)
      CLEANUP=1
      shift
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

[[ -n "$DUMP_PATH" ]] || die "--dump is required"
[[ -f "$DUMP_PATH" ]] || die "Dump file not found: $DUMP_PATH"

# Refuse dumps inside the git work tree to reduce accidental commit pressure
# (backups should live outside the repo).
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
case "$(cd "$(dirname "$DUMP_PATH")" && pwd)/$(basename "$DUMP_PATH")" in
  "$REPO_ROOT"/*)
    die "Dump path is inside the repository. Move backups outside the repo and retry."
    ;;
esac

export AIBUSINESS_FROM_USER_SECRETS
export AIBUSINESS_CONNECTION="${AIBUSINESS_CONNECTION:-}"
load_connection

SOURCE_DB="$PGDATABASE"
# Connection-string Database= identifies the live source used for count
# comparison only. Restore writes exclusively to DEST_NAME.

if [[ -z "$DEST_NAME" ]]; then
  DEST_NAME="aibusiness_restore_$(date -u +%Y%m%dT%H%M%SZ)"
fi

assert_not_forbidden_database "$DEST_NAME" "restore into"
if [[ "$(printf '%s' "$DEST_NAME" | tr '[:upper:]' '[:lower:]')" == "$(printf '%s' "$SOURCE_DB" | tr '[:upper:]' '[:lower:]')" ]]; then
  die "Destination must differ from the connection-string database ('$SOURCE_DB')."
fi

# Validate destination naming for disposable restores (override with explicit flag already checked).
if [[ ! "$DEST_NAME" =~ ^[A-Za-z][A-Za-z0-9_]*$ ]]; then
  die "Destination name must be a simple SQL identifier (letters, digits, underscore)."
fi
if [[ ! "$DEST_NAME" =~ ^aibusiness_restore_ ]]; then
  die "Destination must start with 'aibusiness_restore_' so restores stay disposable by policy."
fi

printf 'Restore plan\n'
printf '  dump:          %s\n' "$DUMP_PATH"
printf '  server:        %s:%s (user=%s)\n' "$PGHOST" "$PGPORT" "$PGUSER"
printf '  source (read): %s (unchanged)\n' "$SOURCE_DB"
printf '  destination:   %s (new)\n' "$DEST_NAME"

create_database "$DEST_NAME"

# Stream dump into pg_restore. Custom format from file on host.
if use_docker_pg; then
  # Copy into the container so pg_restore can read a seekable file (custom format).
  remote="/tmp/aibusiness_restore_$$.dump"
  docker cp "$DUMP_PATH" "${DEFAULT_CONTAINER}:${remote}"
  set +e
  docker exec "$DEFAULT_CONTAINER" \
    pg_restore -U "$PGUSER" -d "$DEST_NAME" --no-owner --no-acl --exit-on-error "$remote"
  restore_status=$?
  set -e
  docker exec "$DEFAULT_CONTAINER" rm -f "$remote" >/dev/null 2>&1 || true
else
  set +e
  pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DEST_NAME" \
    --no-owner --no-acl --exit-on-error "$DUMP_PATH"
  restore_status=$?
  set -e
fi

if [[ "$restore_status" -ne 0 ]]; then
  printf 'error: pg_restore failed (exit %s). Dropping incomplete destination.\n' "$restore_status" >&2
  drop_database_if_requested "$DEST_NAME" || true
  exit "$restore_status"
fi

printf 'Restore finished into database=%s\n' "$DEST_NAME"

src_customers="$(count_table "$SOURCE_DB" Customers)"
src_cases="$(count_table "$SOURCE_DB" Cases)"
src_tasks="$(count_table "$SOURCE_DB" CaseTasks)"
src_notes="$(count_table "$SOURCE_DB" CustomerNotes)"
dst_customers="$(count_table "$DEST_NAME" Customers)"
dst_cases="$(count_table "$DEST_NAME" Cases)"
dst_tasks="$(count_table "$DEST_NAME" CaseTasks)"
dst_notes="$(count_table "$DEST_NAME" CustomerNotes)"

read -r case_orphans task_orphans note_orphans <<<"$(relationship_orphans "$DEST_NAME")"

printf 'Record counts (no row contents):\n'
printf '  Customers:     source=%s restored=%s\n' "$src_customers" "$dst_customers"
printf '  Cases:         source=%s restored=%s\n' "$src_cases" "$dst_cases"
printf '  CaseTasks:     source=%s restored=%s\n' "$src_tasks" "$dst_tasks"
printf '  CustomerNotes: source=%s restored=%s\n' "$src_notes" "$dst_notes"
printf 'Relationship orphans in restored DB: cases_without_customer=%s tasks_without_case=%s notes_without_customer=%s\n' \
  "$case_orphans" "$task_orphans" "$note_orphans"

# Readable smoke checks (existence only, no PII).
readable="$(run_psql "$DEST_NAME" -tAc \
  'SELECT count(*) FROM "Customers" c
   LEFT JOIN "Cases" k ON k."CustomerId" = c."Id"
   LEFT JOIN "CaseTasks" t ON t."CaseId" = k."Id"
   LEFT JOIN "CustomerNotes" n ON n."CustomerId" = c."Id";' | tr -d '[:space:]')"
printf 'Join smoke row-count (customers⋈cases⋈tasks⋈notes): %s\n' "$readable"

failed=0
if [[ "$src_customers" != "$dst_customers" || "$src_cases" != "$dst_cases" || "$src_tasks" != "$dst_tasks" || "$src_notes" != "$dst_notes" ]]; then
  printf 'error: restored counts do not match the live source database.\n' >&2
  failed=1
fi
if [[ "$case_orphans" != "0" || "$task_orphans" != "0" || "$note_orphans" != "0" ]]; then
  printf 'error: restored database has broken foreign-key relationships.\n' >&2
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  if [[ "$CLEANUP" -eq 1 ]]; then
    drop_database_if_requested "$DEST_NAME"
  else
    printf 'Incomplete/failed destination left for inspection: %s\n' "$DEST_NAME" >&2
  fi
  exit 1
fi

printf 'Recovery check: PASSED (counts match; no orphan relationships; tables readable).\n'
printf 'Development database %s was not modified.\n' "$FORBIDDEN_DATABASE"

if [[ "$CLEANUP" -eq 1 ]]; then
  drop_database_if_requested "$DEST_NAME"
  printf 'Cleanup: dropped disposable database %s\n' "$DEST_NAME"
else
  printf 'Disposable database retained: %s\n' "$DEST_NAME"
  printf 'Drop later with: scripts/db/restore.sh helpers — or manually DROP DATABASE "%s";\n' "$DEST_NAME"
fi

# VERIFY_ONLY is informational; restore already verified above.
if [[ "$VERIFY_ONLY" -eq 1 ]]; then
  exit 0
fi
