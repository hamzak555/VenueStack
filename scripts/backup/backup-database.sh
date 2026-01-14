#!/bin/bash

# VenueStack Database Backup Script
# Run this before making schema changes to create a full backup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}VenueStack Database Backup Script${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Check for required environment variables
if [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${RED}Error: SUPABASE_DB_URL environment variable is not set${NC}"
    echo ""
    echo "You can find your database URL in Supabase Dashboard:"
    echo "  1. Go to your project"
    echo "  2. Click 'Project Settings' (gear icon)"
    echo "  3. Click 'Database'"
    echo "  4. Copy the 'Connection string' (URI format)"
    echo ""
    echo "Example:"
    echo "  export SUPABASE_DB_URL='postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres'"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Create backup directory with timestamp
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/venuestack_backup_${TIMESTAMP}"

mkdir -p "$BACKUP_PATH"

echo -e "${GREEN}Creating backup in: ${BACKUP_PATH}${NC}"
echo ""

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump is not installed${NC}"
    echo ""
    echo "Install PostgreSQL client tools:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

echo "1. Backing up full database (schema + data)..."
pg_dump "$SUPABASE_DB_URL" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file="${BACKUP_PATH}/full_backup.dump" \
    2>&1 | grep -v "WARNING" || true

echo "2. Backing up schema only (for reference)..."
pg_dump "$SUPABASE_DB_URL" \
    --schema-only \
    --no-owner \
    --no-privileges \
    --file="${BACKUP_PATH}/schema_only.sql" \
    2>&1 | grep -v "WARNING" || true

echo "3. Backing up data only (for reference)..."
pg_dump "$SUPABASE_DB_URL" \
    --data-only \
    --no-owner \
    --no-privileges \
    --file="${BACKUP_PATH}/data_only.sql" \
    2>&1 | grep -v "WARNING" || true

echo "4. Creating table-by-table backups..."
TABLES=(
    "users"
    "business_users"
    "businesses"
    "events"
    "ticket_types"
    "tickets"
    "orders"
    "order_items"
    "promo_codes"
    "table_bookings"
    "event_table_sections"
    "booking_notes"
    "customer_feedback"
    "tracking_links"
    "page_views"
    "login_logs"
    "invitations"
    "admin_invitations"
    "admin_users"
    "platform_settings"
)

mkdir -p "${BACKUP_PATH}/tables"

for table in "${TABLES[@]}"; do
    echo "   - Backing up table: $table"
    pg_dump "$SUPABASE_DB_URL" \
        --table="public.$table" \
        --no-owner \
        --no-privileges \
        --file="${BACKUP_PATH}/tables/${table}.sql" \
        2>&1 | grep -v "WARNING" || echo "     (table may not exist, skipping)"
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Backup completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Backup location: ${BACKUP_PATH}"
echo ""
echo "Files created:"
ls -la "${BACKUP_PATH}/"
echo ""
echo "To restore from this backup:"
echo "  pg_restore --dbname=\$SUPABASE_DB_URL --clean --if-exists ${BACKUP_PATH}/full_backup.dump"
echo ""
echo -e "${YELLOW}IMPORTANT: Keep this backup safe before running migrations!${NC}"
