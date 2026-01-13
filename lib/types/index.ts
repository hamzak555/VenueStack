export interface UserProfile {
  id: string // matches auth.users id
  email: string
  role: 'admin' | 'business'
  business_id: string | null // Only for business users
  created_at: string
  updated_at: string
}

export interface TablePosition {
  x: number // percentage from left (0-100)
  y: number // percentage from top (0-100)
  width: number // percentage width (default ~5)
  height: number // percentage height (default ~5)
  shape: 'circle' | 'square'
  placed?: boolean // whether the table has been placed on the layout
  layoutId?: string // which layout this table is placed on (for multi-room support)
}

export interface TableSection {
  id: string
  name: string
  tableCount: number
  capacity?: number // Number of people per table
  tableNames?: string[] // Custom names/numbers for each table (e.g., ["VIP 1", "VIP 2", "A1", "A2"])
  tablePositions?: TablePosition[] // Positions on venue layout (indexed by table)
  color?: string // Section color for visual distinction
}

export interface VenueBoundary {
  x: number       // percentage from left (0-100)
  y: number       // percentage from top (0-100)
  width: number   // percentage width
  height: number  // percentage height
  locked?: boolean // When true, cannot be selected/moved
}

export interface VenueLine {
  id: string
  x1: number  // start x (percentage)
  y1: number  // start y (percentage)
  x2: number  // end x (percentage)
  y2: number  // end y (percentage)
  locked?: boolean // When true, cannot be selected/moved
  pathId?: string // Lines with same pathId are treated as one connected shape
}

export interface DrawnVenueLayout {
  boundary: VenueBoundary | null
  lines: VenueLine[]
}

export interface VenueLayout {
  id: string
  label: string // e.g., "Main Room", "VIP Lounge", "Rooftop"
  imageUrl: string | null
  drawnLayout?: DrawnVenueLayout // For drawn (non-image) layouts
  order: number // For sorting/display order
  isDefault?: boolean // The primary/default layout
}

export interface TableServiceConfig {
  sections: TableSection[]
  fontSize?: number // Font size in pixels for table labels (default 12)
  drawnLayout?: DrawnVenueLayout // For venues without uploaded image (legacy, kept for backward compatibility)
  layouts?: VenueLayout[] // Multiple venue layouts/rooms
  activeLayoutId?: string // Currently selected layout in editor
}

export interface EventTableSection {
  id: string
  event_id: string
  section_id: string
  section_name: string
  price: number
  minimum_spend?: number // Minimum spend requirement at the venue
  total_tables: number
  available_tables: number
  capacity?: number // Number of people per table
  max_per_customer?: number // Maximum tables per customer
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface TableBooking {
  id: string
  event_id: string
  event_table_section_id: string
  table_number: number | null // null until business assigns a specific table
  order_id: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  amount: number | null
  tax_amount: number | null
  status: 'reserved' | 'confirmed' | 'cancelled' | 'arrived' | 'seated' | 'completed'
  tracking_link_id: string | null // Reference to tracking link
  tracking_ref: string | null // Raw ref code (persists even if link is deleted)
  created_at: string
  updated_at: string
}

export interface CustomerFeedback {
  id: string
  table_booking_id: string
  business_id: string
  customer_email: string
  rating: number // 1-5 star rating
  feedback: string | null
  created_by_name: string
  created_by_email: string
  created_at: string
  updated_at: string
}

export interface Business {
  id: string
  name: string
  slug: string // Custom URL slug
  description: string | null
  logo_url: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  address: string | null
  address_latitude: number | null // Latitude for Google Maps
  address_longitude: number | null // Longitude for Google Maps
  google_place_id: string | null // Google Places API place ID
  instagram: string | null
  tiktok: string | null
  theme_color: string // Hex color code for business theme (used in background glow effects)
  user_id: string | null // Reference to the business owner's user account
  is_active: boolean
  stripe_account_id: string | null // Stripe Connect account ID
  stripe_onboarding_complete: boolean
  stripe_fee_payer: 'customer' | 'business' // Who pays the Stripe processing fees
  platform_fee_payer: 'customer' | 'business' // Who pays the platform fees
  tax_percentage: number // Tax percentage to apply (0-100)
  use_custom_fee_settings: boolean // If true, use business-specific fee settings; if false, use global platform settings
  platform_fee_type: 'flat' | 'percentage' | 'higher_of_both' | null // Custom fee calculation method (overrides global if use_custom_fee_settings is true)
  flat_fee_amount: number | null // Custom flat fee amount (overrides global if use_custom_fee_settings is true)
  percentage_fee: number | null // Custom percentage fee (overrides global if use_custom_fee_settings is true)
  venue_layout_url: string | null // URL to the venue floor plan image/PDF
  table_service_config: TableServiceConfig | null // Table sections configuration
  // Subscription fields (for SaaS billing)
  stripe_customer_id: string | null // Stripe Customer ID for subscription billing (separate from stripe_account_id)
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid' | null
  subscription_id: string | null // Stripe Subscription ID
  subscription_current_period_end: string | null // When current billing period ends
  subscription_cancel_at_period_end: boolean // Whether subscription will cancel at period end
  trial_end_date: string | null // Extended trial end date (for admin-extended trials)
  subscription_created_at: string | null // When subscription was first created
  created_at: string
  updated_at: string
}

// Recurrence rule for recurring events (similar to Google Calendar's RRULE)
export interface RecurrenceRule {
  type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekdays' | 'custom'
  interval: number // Repeat every N days/weeks/months/years
  daysOfWeek?: number[] // 0-6 for weekly recurrence (0=Sunday, 1=Monday, etc.)
  dayOfMonth?: number // 1-31 for monthly "on day X" recurrence
  weekOfMonth?: number // 1-5 for monthly "on Nth weekday" (1=first, 2=second, ..., 5=last)
  monthOfYear?: number // 1-12 for yearly recurrence
  endType: 'never' | 'date' | 'count'
  endDate?: string // ISO date string for when recurrence ends
  endCount?: number // Number of occurrences before ending
}

export interface Event {
  id: string
  business_id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  location: string | null
  location_latitude: number | null // Latitude for Google Maps
  location_longitude: number | null // Longitude for Google Maps
  google_place_id: string | null // Google Places API place ID
  image_url: string | null
  ticket_price: number
  available_tickets: number
  total_tickets: number
  status: 'draft' | 'published' | 'cancelled'
  timezone: string | null // Business timezone for this event
  recurrence_rule: RecurrenceRule | null // Null means non-recurring event
  parent_event_id: string | null // If this is a recurring instance, points to the parent event
  created_at: string
  updated_at: string
}

export interface Ticket {
  id: string
  event_id: string
  ticket_number: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  purchase_date: string
  status: 'valid' | 'used' | 'cancelled'
  created_at: string
}

export interface DiscountCode {
  id: string
  event_id: string
  code: string
  description: string | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses: number | null // null = unlimited
  current_uses: number
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  item_type: 'ticket'
  item_id: string // ticket_id
  quantity: number
  unit_price: number
  total_price: number
  created_at: string
}

export interface Order {
  id: string
  event_id: string
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  subtotal: number
  discount_code_id: string | null
  discount_amount: number
  total: number
  stripe_payment_intent_id: string | null
  status: 'pending' | 'completed' | 'cancelled' | 'refunded' | 'partially_refunded'
  tracking_link_id: string | null // Reference to tracking link
  tracking_ref: string | null // Raw ref code (persists even if link is deleted)
  created_at: string
  updated_at: string
}

export interface Refund {
  id: string
  order_id: string
  amount: number
  reason: string | null
  stripe_refund_id: string | null
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface PlatformSettings {
  id: string
  platform_fee_type: 'flat' | 'percentage' | 'higher_of_both'
  flat_fee_amount: number
  percentage_fee: number
  platform_stripe_account_id: string | null
  // Subscription settings
  subscription_monthly_fee: number
  subscription_trial_days: number
  stripe_subscription_product_id: string | null
  stripe_subscription_price_id: string | null
  created_at: string
  updated_at: string
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid' | null

// Global user identity
export interface User {
  id: string
  email: string
  phone: string | null
  password_hash: string
  name: string
  created_at: string
  updated_at: string
}

// Business-user link (transitioning to user_id FK)
export interface BusinessUser {
  id: string
  user_id: string | null  // FK to users table (null during migration)
  business_id: string
  // Legacy fields (will be removed after full migration)
  email: string
  password_hash: string
  name: string
  phone: string | null
  // Core fields
  role: 'admin' | 'regular'
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined user data (optional)
  user?: User
}

// Invitation for users to join a business
export interface Invitation {
  id: string
  business_id: string
  email: string | null
  phone: string | null
  role: 'admin' | 'regular'
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  token: string
  invited_by: string
  created_at: string
  expires_at: string
  // Joined business data (optional)
  business?: {
    id: string
    name: string
    slug: string
    logo_url: string | null
  }
}

export interface AdminUser {
  id: string
  email: string
  password_hash: string
  name: string
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LoginLog {
  id: string
  user_type: 'admin' | 'business'
  user_id: string
  user_email: string
  user_name: string
  business_id: string | null
  business_name: string | null
  business_slug: string | null
  ip_address: string | null
  city: string | null
  region: string | null
  country: string | null
  user_agent: string | null
  created_at: string
}

export interface TrackingLink {
  id: string
  business_id: string
  name: string // Display name (e.g., "Instagram Bio Link")
  ref_code: string // URL parameter value (e.g., "instagram")
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TrackingLinkAnalytics {
  tracking_ref: string
  link_name: string | null // null if link was deleted
  total_orders: number
  total_revenue: number
  ticket_orders: number
  ticket_revenue: number
  table_bookings: number
  table_revenue: number
  last_activity: string | null // ISO date of most recent order/booking
}

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>
      }
      businesses: {
        Row: Business
        Insert: Omit<Business, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Business, 'id' | 'created_at' | 'updated_at'>>
      }
      events: {
        Row: Event
        Insert: Omit<Event, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Event, 'id' | 'created_at' | 'updated_at'>>
      }
      tickets: {
        Row: Ticket
        Insert: Omit<Ticket, 'id' | 'created_at'>
        Update: Partial<Omit<Ticket, 'id' | 'created_at'>>
      }
      discount_codes: {
        Row: DiscountCode
        Insert: Omit<DiscountCode, 'id' | 'created_at' | 'updated_at' | 'current_uses'>
        Update: Partial<Omit<DiscountCode, 'id' | 'created_at' | 'updated_at'>>
      }
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Order, 'id' | 'created_at' | 'updated_at'>>
      }
      order_items: {
        Row: OrderItem
        Insert: Omit<OrderItem, 'id' | 'created_at'>
        Update: Partial<Omit<OrderItem, 'id' | 'created_at'>>
      }
      platform_settings: {
        Row: PlatformSettings
        Insert: Omit<PlatformSettings, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PlatformSettings, 'id' | 'created_at' | 'updated_at'>>
      }
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
      }
      business_users: {
        Row: BusinessUser
        Insert: Omit<BusinessUser, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<BusinessUser, 'id' | 'created_at' | 'updated_at'>>
      }
      invitations: {
        Row: Invitation
        Insert: Omit<Invitation, 'id' | 'created_at'>
        Update: Partial<Omit<Invitation, 'id' | 'created_at'>>
      }
      admin_users: {
        Row: AdminUser
        Insert: Omit<AdminUser, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AdminUser, 'id' | 'created_at' | 'updated_at'>>
      }
      tracking_links: {
        Row: TrackingLink
        Insert: Omit<TrackingLink, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TrackingLink, 'id' | 'created_at' | 'updated_at'>>
      }
      login_logs: {
        Row: LoginLog
        Insert: Omit<LoginLog, 'id' | 'created_at'>
        Update: never
      }
    }
  }
}
