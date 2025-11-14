-- Add tax_percentage column to businesses table
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (tax_percentage >= 0 AND tax_percentage <= 100);

COMMENT ON COLUMN businesses.tax_percentage IS 'Tax percentage to be applied to ticket sales (0-100)';
