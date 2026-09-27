#!/usr/bin/env bash
# Drop a disposable aibusiness_restore_* database. Refuses the development DB.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/db/drop-restore-db.sh --database aibusiness_restore_... [options]

Drops a disposable restore database. Refuses aibusiness_customers_dev.

Options:
  --database <name>       Must start with aibusiness_restore_
  --from-user-secrets     Read connection from API user-secrets
  --connection <str>      Npgsql connection string
  -h, --help
EOF
}

AIBUSINESS_FROM_USER_SECRETS="${AIBUSINESS_FROM_USER_SECRETS:-0}"
NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --database)
      [[ $# -ge 2 ]] || die "--database requires a name"
      NAME="$2"
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
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ -n "$NAME" ]] || die "--database is required"
[[ "$NAME" =~ ^aibusiness_restore_ ]] || die "Only aibusiness_restore_* databases may be dropped by this script."
assert_not_forbidden_database "$NAME" "drop"

export AIBUSINESS_FROM_USER_SECRETS
export AIBUSINESS_CONNECTION="${AIBUSINESS_CONNECTION:-}"
load_connection

drop_database_if_requested "$NAME"
printf 'Dropped disposable database: %s\n' "$NAME"
printf 'Development database %s was not modified.\n' "$FORBIDDEN_DATABASE"
