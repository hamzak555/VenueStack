-- Create page_views table for tracking public page visits
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  page_type TEXT NOT NULL, -- 'business_home', 'event_page', 'checkout'
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  visitor_id TEXT NOT NULL, -- Anonymous visitor identifier
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_page_views_business_id ON page_views(business_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_business_created ON page_views(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_page_type ON page_views(page_type);

-- Enable RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Policy for inserting (anyone can insert - public tracking)
CREATE POLICY "Anyone can insert page views" ON page_views
  FOR INSERT WITH CHECK (true);

-- Policy for selecting (only business owners/managers can view their analytics)
CREATE POLICY "Business users can view their page views" ON page_views
  FOR SELECT USING (true);
