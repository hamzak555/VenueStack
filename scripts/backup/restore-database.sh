#!/bin/bash

# VenueStack Database Restore Script
# Use this to restore from a backup if something goes wrong

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}VenueStack Database Restore Script${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

if [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${RED}Error: SUPABASE_DB_URL environment variable is not set${NC}"
    exit 1
fi

if [ -z "$1" ]; then
    echo -e "${RED}Error: Please provide the backup file path${NC}"
    echo ""
    echo "Usage: ./restore-database.sh <backup_file>"
    echo ""
    echo "Available backups:"
    ls -la ./backups/*/full_backup.dump 2>/dev/null || echo "  No backups found in ./backups/"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

echo -e "${YELLOW}WARNING: This will restore the database from:${NC}"
echo "  ${BACKUP_FILE}"
echo ""
echo -e "${RED}This operation will OVERWRITE existing data!${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "Restoring database..."

pg_restore \
    --dbname="$SUPABASE_DB_URL" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "$BACKUP_FILE" \
    2>&1 | grep -v "WARNING" || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Database restored successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
