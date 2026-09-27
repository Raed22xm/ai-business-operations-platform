#!/usr/bin/env bash
# Manual PostgreSQL backup for AiBusiness (customers, notes, cases, tasks, migrations).
# Writes a timestamped custom-format dump outside the repository.
# Never prints passwords.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/db/backup.sh [options]

Creates a timestamped pg_dump (-Fc) of the configured database, including
Customers, CustomerNotes, Cases, CaseTasks, CaseActivities, and __EFMigrationsHistory.

Options:
  --from-user-secrets   Read ConnectionStrings:DefaultConnection from API user-secrets
  --connection <str>    Npgsql connection string (prefer env vars instead)
  --output-dir <dir>    Override backup directory (default: OS app data / AiBusiness/backups)
  -h, --help            Show this help

Environment:
  ConnectionStrings__DefaultConnection / AIBUSINESS_DATABASE_URL
  AIBUSINESS_BACKUP_DIR
  AIBUSINESS_PG_CONTAINER (default: aibusiness-customers-postgres)

Backups contain customer data. Store them only in a protected location.
EOF
}

AIBUSINESS_FROM_USER_SECRETS="${AIBUSINESS_FROM_USER_SECRETS:-0}"
OUTPUT_DIR_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-user-secrets)
      AIBUSINESS_FROM_USER_SECRETS=1
      shift
      ;;
    --connection)
      [[ $# -ge 2 ]] || die "--connection requires a value"
      AIBUSINESS_CONNECTION="$2"
      shift 2
      ;;
    --output-dir)
      [[ $# -ge 2 ]] || die "--output-dir requires a value"
      OUTPUT_DIR_OVERRIDE="$2"
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

export AIBUSINESS_FROM_USER_SECRETS
export AIBUSINESS_CONNECTION="${AIBUSINESS_CONNECTION:-}"
load_connection

if [[ -n "$OUTPUT_DIR_OVERRIDE" ]]; then
  export AIBUSINESS_BACKUP_DIR="$OUTPUT_DIR_OVERRIDE"
fi

dir="$(ensure_backup_dir)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
safe_db="$(printf '%s' "$PGDATABASE" | tr -c 'A-Za-z0-9._-' '_')"
outfile="${dir}/${safe_db}_${stamp}.dump"

printf 'Backing up database=%s host=%s port=%s\n' "$PGDATABASE" "$PGHOST" "$PGPORT"
printf 'Destination (outside repo): %s\n' "$outfile"

# Custom format supports selective restore and is compressed by default.
run_pg_dump --format=custom --no-owner --no-acl >"$outfile"

chmod 600 "$outfile" 2>/dev/null || true

size="$(wc -c <"$outfile" | tr -d '[:space:]')"
if [[ "$size" -lt 100 ]]; then
  rm -f "$outfile"
  die "Backup file looks empty (${size} bytes). Aborting."
fi

# Write a sidecar metadata file without customer row contents or secrets.
meta="${outfile}.meta.json"
cat >"$meta" <<EOF
{
  "createdAtUtc": "${stamp}",
  "sourceDatabase": "$(printf '%s' "$PGDATABASE" | sed 's/"/\\"/g')",
  "sourceHost": "$(printf '%s' "$PGHOST" | sed 's/"/\\"/g')",
  "sourcePort": "$(printf '%s' "$PGPORT" | sed 's/"/\\"/g')",
  "format": "pg_dump custom (-Fc)",
  "bytes": ${size},
  "tool": "scripts/db/backup.sh"
}
EOF
chmod 600 "$meta" 2>/dev/null || true

printf 'Backup complete.\n'
printf 'File: %s (%s bytes)\n' "$outfile" "$size"
printf 'Meta: %s\n' "$meta"
printf 'Reminder: this file contains customer data — keep it private; do not commit it.\n'
