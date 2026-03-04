import { createClient } from '@supabase/supabase-js'
import type { Wine, Vintage, Profile, CellarItem, Movement, AdminMessage, SommelierReview, ExchangeRate, AppConfig, CellarShare } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('⚠️ Supabase URL není nakonfigurována. Nastavte VITE_SUPABASE_URL v .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Typed DB helpers ─────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile> }
      wines: { Row: Wine; Insert: Omit<Wine, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Wine> }
      vintages: { Row: Vintage; Insert: Omit<Vintage, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Vintage> }
      cellar_items: { Row: CellarItem; Insert: Omit<CellarItem, 'id' | 'created_at' | 'updated_at'>; Update: Partial<CellarItem> }
      movements: { Row: Movement; Insert: Omit<Movement, 'id' | 'created_at'>; Update: Partial<Movement> }
      admin_messages: { Row: AdminMessage; Insert: Omit<AdminMessage, 'id' | 'created_at'>; Update: Partial<AdminMessage> }
      sommelier_reviews: { Row: SommelierReview; Insert: Omit<SommelierReview, 'id' | 'created_at' | 'updated_at'>; Update: Partial<SommelierReview> }
      exchange_rates: { Row: ExchangeRate; Insert: Omit<ExchangeRate, 'id'>; Update: Partial<ExchangeRate> }
      app_config: { Row: AppConfig; Insert: AppConfig; Update: Partial<AppConfig> }
      cellar_shares: { Row: CellarShare; Insert: Omit<CellarShare, 'id' | 'created_at'>; Update: Partial<CellarShare> }
    }
  }
}
