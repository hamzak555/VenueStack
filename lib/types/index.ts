export interface UserProfile {
  id: string // matches auth.users id
  email: string
  role: 'admin' | 'business'
  business_id: string | null // Only for business users
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
  user_id: string | null // Reference to the business owner's user account
  is_active: boolean
  stripe_account_id: string | null // Stripe Connect account ID
  stripe_onboarding_complete: boolean
  stripe_fee_payer: 'customer' | 'business' // Who pays the Stripe processing fees
  platform_fee_payer: 'customer' | 'business' // Who pays the platform fees
  tax_percentage: number // Tax percentage to apply (0-100)
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  business_id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  location: string | null
  image_url: string | null
  ticket_price: number
  available_tickets: number
  total_tickets: number
  status: 'draft' | 'published' | 'cancelled'
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
  status: 'pending' | 'completed' | 'cancelled' | 'refunded'
  created_at: string
  updated_at: string
}

export interface PlatformSettings {
  id: string
  platform_fee_type: 'flat' | 'percentage' | 'higher_of_both'
  flat_fee_amount: number
  percentage_fee: number
  platform_stripe_account_id: string | null
  created_at: string
  updated_at: string
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
    }
  }
}
