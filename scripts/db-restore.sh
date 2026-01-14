#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/db-restore.sh --file PATH [--clean]

Restores a custom-format pg_dump created by scripts/db-backup.sh.

Required env:
  - SUPABASE_DB_URL or DATABASE_URL (Postgres connection string)

Notes:
  - Use --clean to drop objects before restoring (destructive).
EOF
}

db_url="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
dump_file=""
clean="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) dump_file="${2:-}"; shift 2 ;;
    --clean) clean="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "$db_url" ]]; then
  echo "Missing SUPABASE_DB_URL (or DATABASE_URL)." >&2
  usage
  exit 2
fi

if [[ "$db_url" =~ [[:space:]] ]]; then
  echo "SUPABASE_DB_URL contains whitespace/newlines. Paste it as a single uninterrupted line." >&2
  exit 2
fi

if [[ -z "$dump_file" ]]; then
  echo "Missing --file PATH." >&2
  usage
  exit 2
fi

if [[ ! -f "$dump_file" ]]; then
  echo "Dump file not found: $dump_file" >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore not found. Install Postgres client tools (pg_dump/pg_restore)." >&2
  exit 1
fi

restore_args=(
  --no-owner
  --no-privileges
  --dbname="$db_url"
)

if [[ "$clean" == "true" ]]; then
  restore_args+=(--clean --if-exists)
fi

pg_restore "${restore_args[@]}" "$dump_file"

echo "Restore complete: $dump_file"
