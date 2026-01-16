-- Add descriptions to all active Supabase tables
-- Run this in the Supabase SQL Editor to add table descriptions

-- Core Business & User Management
COMMENT ON TABLE businesses IS 'Primary business entity storing branding, location, Stripe integration, and subscription details for each venue';

COMMENT ON TABLE users IS 'Global user identity table with authentication credentials linking to multiple businesses';

COMMENT ON TABLE business_users IS 'Junction table linking users to businesses with role assignments (owner, manager, host, accounting, server)';

-- Event & Ticketing
COMMENT ON TABLE events IS 'Event details including date, time, location, pricing, and ticket availability. Supports recurring events and Google Places integration';

COMMENT ON TABLE ticket_types IS 'Different ticket tiers for events with pricing, quantity limits, sale date ranges, and display ordering';

COMMENT ON TABLE tickets IS 'Individual ticket records with unique ticket numbers, customer info, and status tracking (valid, used, cancelled, invalid)';

COMMENT ON TABLE orders IS 'Aggregated ticket purchases tracking order numbers, customer info, totals, and Stripe payment intent';

COMMENT ON TABLE promo_codes IS 'Promotional codes for events with usage limits, fixed or percentage discounts, and validity ranges';

-- Table Service & Reservations
COMMENT ON TABLE event_table_sections IS 'Table sections/areas within a venue for specific events, tracking capacity, pricing, server assignments, and linked tables';

COMMENT ON TABLE table_bookings IS 'Table reservations with customer details and status workflow (requested, approved, confirmed, cancelled, arrived, seated, completed)';

COMMENT ON TABLE table_booking_refunds IS 'Refunds specific to table bookings tracking amount, status, processor, and order association';

-- Revenue & Analytics
COMMENT ON TABLE refunds IS 'Ticket order refunds with Stripe integration tracking status, processor, and ticket voiding';

COMMENT ON TABLE platform_settings IS 'Global platform configuration including fee structure, subscription pricing, and Stripe product IDs';

-- Customer & Feedback
COMMENT ON TABLE customer_feedback IS 'Post-event ratings and feedback (1-5 stars) linked to table bookings and customers';

-- Access & Invitations
COMMENT ON TABLE invitations IS 'Invitations for users to join businesses with role, token, status (pending, accepted, expired, cancelled), and expiration';

COMMENT ON TABLE admin_invitations IS 'Separate invitation system for platform admin accounts';

-- Marketing & Analytics
COMMENT ON TABLE tracking_links IS 'Custom UTM parameters for marketing campaigns with ref_codes for attributing orders and bookings';

COMMENT ON TABLE page_views IS 'Public page visit tracking for analytics including page type, visitor ID, referrer, and traffic source';

COMMENT ON TABLE login_logs IS 'Authentication audit trail tracking user type, IP address, geolocation, and device information';

-- Event Content
COMMENT ON TABLE event_artists IS 'Artists and performers associated with events for lineup display';

-- Auxiliary
COMMENT ON TABLE stripe_webhook_events IS 'Webhook event audit trail for Stripe preventing duplicate processing (idempotency)';

COMMENT ON TABLE phone_verification_codes IS 'One-time codes for SMS phone verification during authentication';
