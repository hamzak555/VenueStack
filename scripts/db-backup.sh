#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/db-backup.sh [--public-only|--all-schemas] [--schema-only|--data-only] [--out-dir DIR]

Creates a timestamped Postgres backup using pg_dump.

Required env:
  - SUPABASE_DB_URL or DATABASE_URL (Postgres connection string)

Examples:
  SUPABASE_DB_URL="postgresql://..." scripts/db-backup.sh
  SUPABASE_DB_URL="postgresql://..." scripts/db-backup.sh --all-schemas
  SUPABASE_DB_URL="postgresql://..." scripts/db-backup.sh --schema-only
EOF
}

db_url="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
scope="public"
dump_mode="full"
out_dir="backups"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public-only) scope="public"; shift ;;
    --all-schemas) scope="all"; shift ;;
    --schema-only) dump_mode="schema"; shift ;;
    --data-only) dump_mode="data"; shift ;;
    --out-dir) out_dir="${2:-}"; shift 2 ;;
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

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install Postgres client tools (pg_dump/pg_restore)." >&2
  exit 1
fi

ts="$(date +"%Y%m%d_%H%M%S")"
mkdir -p "$out_dir"

base="$out_dir/venuestack_${scope}_${dump_mode}_${ts}"
custom_file="${base}.dump"
schema_file="${base}.schema.sql"

pg_dump_args=(
  --no-owner
  --no-privileges
  --format=custom
  --file="$custom_file"
)

case "$scope" in
  public) pg_dump_args+=(--schema=public) ;;
  all) ;;
  *) echo "Invalid scope: $scope" >&2; exit 2 ;;
esac

case "$dump_mode" in
  full) ;;
  schema) pg_dump_args+=(--schema-only) ;;
  data) pg_dump_args+=(--data-only) ;;
  *) echo "Invalid dump mode: $dump_mode" >&2; exit 2 ;;
esac

pg_dump "${pg_dump_args[@]}" "$db_url"

# Also emit a plain SQL schema snapshot for quick diffing/inspection.
schema_args=(
  --no-owner
  --no-privileges
  --schema-only
  --file="$schema_file"
)
if [[ "$scope" == "public" ]]; then
  schema_args+=(--schema=public)
fi
pg_dump "${schema_args[@]}" "$db_url"

echo "Backup created:"
echo "  $custom_file"
echo "  $schema_file"
