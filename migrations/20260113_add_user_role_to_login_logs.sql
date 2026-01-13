-- Add user_role column to login_logs table
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS user_role TEXT;
