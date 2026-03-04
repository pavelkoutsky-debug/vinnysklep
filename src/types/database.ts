// ============================================================
// DATABASE TYPES – odpovídají Supabase PostgreSQL schématu
// ============================================================

export type UserRole = 'user' | 'admin'

export interface SensoryProfile {
  aroma: string | null
  taste: string | null
  finish: string | null
  body: 'light' | 'medium' | 'full' | null
  tannins: 'low' | 'medium' | 'high' | null
  acidity: 'low' | 'medium' | 'high' | null
}
export type WineColor = 'red' | 'white' | 'rose' | 'orange' | 'sparkling' | 'dessert' | 'fortified'
export type MaturityStatus = 'too_young' | 'can_drink' | 'ideal' | 'drink_soon' | 'past_peak'
export type MovementType = 'add' | 'remove'
export type MovementReason = 'purchase' | 'gift_received' | 'consumed' | 'gift_given' | 'sold' | 'broken' | 'import' | 'other'
export type MessageType = 'news' | 'event' | 'recommendation' | 'system'
export type DataSource = 'vinnyshop' | 'gemini' | 'manual' | 'ai'
export type DataConfidence = 'high' | 'medium' | 'low'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  preferred_currency: string
  notifications_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Wine {
  id: string
  name: string
  name_cs: string | null
  winery: string | null
  winery_cs: string | null
  country: string
  country_cs: string
  region: string | null
  region_cs: string | null
  appellation: string | null
  grapes: string[] | null
  grapes_cs: string[] | null
  color: WineColor
  alcohol_percentage: number | null
  classification: string | null
  description: string | null
  description_cs: string | null
  food_pairing: string[] | null
  food_pairing_cs: string[] | null
  vinnyshop_url: string | null
  vivino_id: string | null
  vivino_url: string | null
  image_url: string | null
  average_rating: number | null
  ratings_count: number | null
  data_source: DataSource | null
  gemini_confidence: DataConfidence | null
  cache_expires_at: string | null
  barcode: string | null
  sensory_profile: SensoryProfile | null
  winery_history_cs: string | null
  created_at: string
  updated_at: string
}

export interface Vintage {
  id: string
  wine_id: string
  year: number
  drink_from: number | null
  drink_until: number | null
  peak_start: number | null
  peak_end: number | null
  price_eur: number | null
  rating: number | null
  notes: string | null
  notes_cs: string | null
  expert_rating_avg: number | null
  expert_rating_text: string | null
  created_at: string
  updated_at: string
}

export interface CellarItem {
  id: string
  user_id: string
  vintage_id: string
  quantity: number
  location: string | null
  purchase_date: string | null
  purchase_price: number | null
  purchase_currency: string
  notes: string | null
  personal_rating: number | null
  added_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  vintage?: Vintage & { wine?: Wine }
}

export interface Movement {
  id: string
  cellar_item_id: string
  user_id: string
  type: MovementType
  quantity: number
  reason: MovementReason | null
  date: string
  notes: string | null
  consumption_rating: number | null
  food_paired: string | null
  created_at: string
}

export interface CellarShare {
  id: string
  user_id: string
  share_token: string
  name: string | null
  is_active: boolean
  created_at: string
  expires_at: string | null
}

export interface ExchangeRate {
  id: string
  base_currency: string
  target_currency: string
  rate: number
  fetched_at: string
}

export interface AdminMessage {
  id: string
  sender_id: string
  recipient_id: string | null
  subject: string
  content: string
  message_type: MessageType
  created_at: string
  is_read?: boolean
}

export interface SommelierReview {
  id: string
  vintage_id: string
  sommelier_id: string
  drink_from_override: number | null
  drink_until_override: number | null
  peak_start_override: number | null
  peak_end_override: number | null
  maturity_status: MaturityStatus | null
  tasting_date: string
  tasting_notes: string
  tasting_notes_cs: string | null
  sommelier_rating: number | null
  recommendation: string | null
  food_pairing_override: string[] | null
  food_pairing_override_cs: string[] | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface AppConfig {
  key: string
  value: unknown
  updated_at: string
}
