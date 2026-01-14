# VenueStack Database Migrations

## Overview

This directory contains SQL migrations to optimize the Supabase database for performance, security, and maintainability.

## Migration Order

Run these migrations **in order** after creating a backup:

1. `20260113_add_indexes.sql` - Performance indexes
2. `20260113_add_rls_policies.sql` - Row Level Security
3. `20260113_add_denormalized_columns.sql` - Denormalization + constraints
4. `20260113_add_rpc_functions.sql` - Database functions

## Before Running Migrations

### 1. Create a Backup

```bash
# Set your database URL
export SUPABASE_DB_URL='postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres'

# Run backup script
cd scripts/backup
./backup-database.sh
```

### 2. Verify Environment

Ensure `SESSION_SECRET` is set in your `.env.local`:

```bash
# Generate a secure secret
openssl rand -base64 32
```

## Running Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Paste each migration file content
4. Click **Run**
5. Verify no errors

### Option 2: Command Line

```bash
# Using psql
psql "$SUPABASE_DB_URL" -f migrations/20260113_add_indexes.sql
psql "$SUPABASE_DB_URL" -f migrations/20260113_add_rls_policies.sql
psql "$SUPABASE_DB_URL" -f migrations/20260113_add_denormalized_columns.sql
psql "$SUPABASE_DB_URL" -f migrations/20260113_add_rpc_functions.sql
```

## What Each Migration Does

### 20260113_add_indexes.sql

Adds ~30 indexes to optimize common queries:

- Orders by event, status, customer email/phone
- Table bookings by event, status, section
- Events by business, date, status
- Tickets by event, order, ticket type
- Business users by business, email, user_id
- And more...

**Impact**: Improves query performance, especially for analytics and customer lookups.

### 20260113_add_rls_policies.sql

Enables Row Level Security on all tables:

- Service role has full access (server-side operations)
- Anon role restricted to:
  - Read active businesses (public pages)
  - Read published events
  - Read ticket types for published events
  - Insert page views (analytics tracking)
  - Validate promo codes

**Impact**: Protects against unauthorized direct API access. **Critical for security.**

### 20260113_add_denormalized_columns.sql

Adds `business_id` column to:
- `orders`
- `table_bookings`
- `tickets`

Also adds:
- Triggers to auto-populate `business_id` on insert
- Unique constraints on `businesses.slug`, `tracking_links.ref_code`

**Impact**: Eliminates JOIN through `events` table for business-scoped queries.

### 20260113_add_rpc_functions.sql

Creates database functions:
- `decrement_ticket_quantity()` - Atomic ticket decrement
- `decrement_table_quantity()` - Atomic table decrement
- `increment_promo_code_usage()` - Atomic promo code usage
- `get_ticket_types_batch()` - Batch ticket type fetch
- `get_customer_summary()` - Customer aggregation in SQL
- `get_event_analytics()` - Event analytics in SQL

**Impact**: Moves aggregation from JavaScript to PostgreSQL for better performance.

## Verification

After running migrations, verify:

```sql
-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public';

-- Check denormalized columns populated
SELECT
  COUNT(*) as total,
  COUNT(business_id) as with_business_id
FROM orders;

-- Check triggers
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

## Rollback

If something goes wrong, restore from backup:

```bash
cd scripts/backup
./restore-database.sh ./backups/venuestack_backup_TIMESTAMP/full_backup.dump
```

## Application Changes

The following application code was also updated:

### Security Fixes
- `lib/auth/admin-session.ts` - SESSION_SECRET validation
- `lib/auth/business-session.ts` - SESSION_SECRET validation
- `lib/auth/password-validation.ts` - New password validation utility
- `app/api/auth/register/route.ts` - Stronger password requirements
- `app/api/auth/reset-password/route.ts` - Stronger password requirements

### Performance Fixes
- `lib/db/ticket-types.ts` - Added batch fetch and atomic decrement
- `app/api/checkout/complete-free-order/route.ts` - Fixed N+1 query, specific column selects

## Future Recommendations

1. **Customer Table**: Create a proper `customers` table instead of reconstructing from orders/bookings
2. **User Migration**: Complete the `user_id` migration in `business_users`
3. **Summary Tables**: Add daily/weekly analytics summary tables for faster reporting
4. **Archive Strategy**: Implement data archival for `login_logs` and `page_views`
