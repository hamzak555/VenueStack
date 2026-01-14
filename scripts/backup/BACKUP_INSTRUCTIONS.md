# VenueStack Database Backup Instructions

## Before Making Schema Changes

Always create a backup before running migrations or making schema changes.

---

## Option 1: Using the Backup Script (Recommended)

### Prerequisites
- PostgreSQL client tools installed (`pg_dump`)
- Your Supabase database connection URL

### Steps

1. **Get your database URL from Supabase:**
   - Go to your Supabase project dashboard
   - Click "Project Settings" (gear icon)
   - Click "Database"
   - Copy the "Connection string" (URI format)

2. **Set the environment variable:**
   ```bash
   export SUPABASE_DB_URL='postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres'
   ```

3. **Run the backup script:**
   ```bash
   cd scripts/backup
   ./backup-database.sh
   ```

4. **Verify the backup:**
   - Check the `backups/` directory for the new backup folder
   - Confirm `full_backup.dump` exists and has a reasonable size

---

## Option 2: Using Supabase Dashboard

### Steps

1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Backups**
3. Click **Create backup** (if on Pro plan)
4. Download the backup file

### For Free Plan Users

Free plan doesn't include automatic backups. Use Option 1 or:

1. Go to **SQL Editor** in Supabase Dashboard
2. Run this query to export each table as CSV:
   ```sql
   -- Example for orders table
   SELECT * FROM orders;
   ```
3. Click "Download CSV" for each result
4. Repeat for all important tables

---

## Restoring from Backup

### If Something Goes Wrong

1. **Set environment variable:**
   ```bash
   export SUPABASE_DB_URL='your-connection-string'
   ```

2. **Run restore script:**
   ```bash
   ./restore-database.sh ./backups/venuestack_backup_TIMESTAMP/full_backup.dump
   ```

3. **Verify the restore:**
   - Check your application to ensure data is intact
   - Verify critical tables have data

---

## Important Tables to Backup

Priority order for manual backup:

1. **Critical (customer data):**
   - `users`
   - `business_users`
   - `businesses`
   - `orders`
   - `tickets`
   - `table_bookings`

2. **Important (config):**
   - `events`
   - `ticket_types`
   - `event_table_sections`
   - `promo_codes`
   - `platform_settings`

3. **Analytics (can be regenerated):**
   - `page_views`
   - `login_logs`
   - `tracking_links`

---

## Backup Schedule Recommendation

- **Before any migration**: Always create a backup
- **Weekly**: For production environments
- **Daily**: For high-traffic applications

Consider upgrading to Supabase Pro for automatic daily backups.
