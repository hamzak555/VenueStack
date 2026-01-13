-- Role System Migration: admin -> owner, regular -> manager
-- Run this migration in Supabase SQL Editor

-- Step 1: Drop the old check constraints
ALTER TABLE business_users DROP CONSTRAINT IF EXISTS business_users_role_check;
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;

-- Step 2: Update the data BEFORE adding new constraints
-- Update business_users table
UPDATE business_users SET role = 'owner' WHERE role = 'admin';
UPDATE business_users SET role = 'manager' WHERE role = 'regular';

-- Update invitations table
UPDATE invitations SET role = 'owner' WHERE role = 'admin';
UPDATE invitations SET role = 'manager' WHERE role = 'regular';

-- Step 3: Add new check constraints with updated role values
ALTER TABLE business_users ADD CONSTRAINT business_users_role_check
  CHECK (role IN ('owner', 'manager', 'host', 'accounting', 'server'));

ALTER TABLE invitations ADD CONSTRAINT invitations_role_check
  CHECK (role IN ('owner', 'manager', 'host', 'accounting', 'server'));

-- Step 4: Verify the changes
SELECT 'business_users roles:' as table_name, role, COUNT(*) as count
FROM business_users
GROUP BY role
UNION ALL
SELECT 'invitations roles:' as table_name, role, COUNT(*) as count
FROM invitations
GROUP BY role;

-- =====================================================
-- Add created_by fields to table_bookings
-- =====================================================

-- Add created_by_name and created_by_email columns to table_bookings
ALTER TABLE table_bookings ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE table_bookings ADD COLUMN IF NOT EXISTS created_by_email TEXT;

-- Add requested_table_number for server-created reservations
-- When a server creates a reservation, they can select a table but it won't be assigned
-- The requested_table_number stores their selection for reference
ALTER TABLE table_bookings ADD COLUMN IF NOT EXISTS requested_table_number TEXT;

-- =====================================================
-- Enable Realtime for table_bookings
-- =====================================================
-- This allows clients to subscribe to changes in the table_bookings table
-- for live updates in the table service UI

-- Add table_bookings to realtime publication (skip if already added)
-- Note: Run this only if not already enabled:
-- ALTER PUBLICATION supabase_realtime ADD TABLE table_bookings;
--
-- To check if already enabled:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
