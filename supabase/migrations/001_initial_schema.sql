-- =====================================================
-- VINNÝ SKLEP – Kompletní databázové schema
-- Verze: 1.0 (optimalizovaná, rozšířená oproti spec v3.1)
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS unaccent;  -- Normalizace diakritiky (č→c, é→e...)
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- Fuzzy vyhledávání názvů vín

-- unaccent() je jen STABLE, generated columns vyžadují IMMUTABLE – vytvoříme wrapper
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT unaccent($1);
$$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE;

-- =====================================================
-- KONFIGURACE
-- =====================================================
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO app_config (key, value) VALUES
  ('max_users', '30'),
  ('max_image_size_mb', '2'),
  ('supported_currencies', '["CZK", "EUR", "USD"]'),
  ('default_currency', '"CZK"'),
  ('wine_cache_days', '30');

-- =====================================================
-- UŽIVATELÉ
-- =====================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  preferred_currency TEXT DEFAULT 'CZK',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger: automatické vytvoření profilu při registraci
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  initial_admin_email TEXT;
  user_role TEXT;
BEGIN
  -- Načtení admin emailu z konfigurace (bezpečnější než hardcode)
  SELECT value::TEXT INTO initial_admin_email FROM app_config WHERE key = 'initial_admin_email';

  -- Fallback na hardcoded hodnotu pokud config neexistuje
  IF initial_admin_email IS NULL THEN
    initial_admin_email := '"pavel.koutsky@gmail.com"';
  END IF;

  -- Odstranit uvozovky z JSON stringu
  initial_admin_email := TRIM(BOTH '"' FROM initial_admin_email);

  IF NEW.email = initial_admin_email THEN
    user_role := 'admin';
  ELSE
    user_role := 'user';
  END IF;

  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Nastavit admin email do konfigurace
INSERT INTO app_config (key, value) VALUES ('initial_admin_email', '"pavel.koutsky@gmail.com"')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- KATALOG VÍN (sdílený, s cache)
-- =====================================================
CREATE TABLE wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Základní údaje
  name TEXT NOT NULL,
  name_cs TEXT,
  winery TEXT,
  winery_cs TEXT,
  -- Lokace
  country TEXT NOT NULL,
  country_cs TEXT NOT NULL,
  region TEXT,
  region_cs TEXT,
  appellation TEXT,
  -- Charakteristika
  grapes TEXT[],
  grapes_cs TEXT[],
  color TEXT NOT NULL CHECK (color IN ('red', 'white', 'rose', 'orange', 'sparkling', 'dessert', 'fortified')),
  alcohol_percentage DECIMAL(4,2),
  classification TEXT,
  -- Popisy
  description TEXT,
  description_cs TEXT,
  -- Párování
  food_pairing TEXT[],
  food_pairing_cs TEXT[],
  -- Externí zdroje
  vinnyshop_url TEXT,
  vivino_id TEXT,
  vivino_url TEXT,
  -- Obrázky
  image_url TEXT,
  -- Hodnocení
  average_rating DECIMAL(3,2) CHECK (average_rating >= 0 AND average_rating <= 5),
  ratings_count INTEGER,
  -- Metadata + cache (NOVÉ oproti spec)
  data_source TEXT CHECK (data_source IN ('vinnyshop', 'gemini', 'manual', 'ai')),
  gemini_confidence TEXT CHECK (gemini_confidence IN ('high', 'medium', 'low')),
  cache_expires_at TIMESTAMP WITH TIME ZONE,
  barcode TEXT,  -- EAN čárový kód
  -- Full-text search (NOVÉ)
  name_normalized TEXT GENERATED ALWAYS AS (
    lower(regexp_replace(immutable_unaccent(name), '[^a-z0-9 ]', '', 'g'))
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, winery)
);

-- Fuzzy search index
CREATE INDEX idx_wines_name_trgm ON wines USING gin(name gin_trgm_ops);
CREATE INDEX idx_wines_name_normalized_trgm ON wines USING gin(name_normalized gin_trgm_ops);
CREATE INDEX idx_wines_country ON wines(country);
CREATE INDEX idx_wines_color ON wines(color);
CREATE INDEX idx_wines_cache_expires ON wines(cache_expires_at);

-- =====================================================
-- ROČNÍKY VÍN
-- =====================================================
CREATE TABLE vintages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id UUID NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 1900 AND year <= 2200),
  -- Zralost (automatická, přepsatelná sommelierem)
  drink_from INTEGER,
  drink_until INTEGER,
  peak_start INTEGER,
  peak_end INTEGER,
  -- Cena a hodnocení
  price_eur DECIMAL(10,2),
  rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5),
  -- Poznámky
  notes TEXT,
  notes_cs TEXT,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wine_id, year)
);

CREATE INDEX idx_vintages_wine ON vintages(wine_id);
CREATE INDEX idx_vintages_year ON vintages(year);

-- =====================================================
-- SKLEP UŽIVATELE
-- =====================================================
CREATE TABLE cellar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vintage_id UUID NOT NULL REFERENCES vintages(id),
  -- Skladové údaje
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  location TEXT,
  -- Nákupní údaje
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  purchase_currency TEXT DEFAULT 'CZK' CHECK (purchase_currency IN ('CZK', 'EUR', 'USD')),
  -- Osobní údaje
  notes TEXT,
  personal_rating INTEGER CHECK (personal_rating >= 0 AND personal_rating <= 100),
  -- Pozice v mapě sklepa (NOVÉ)
  position_row INTEGER,
  position_col INTEGER,
  position_label TEXT,
  -- Metadata
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cellar_items_user ON cellar_items(user_id);
CREATE INDEX idx_cellar_items_vintage ON cellar_items(vintage_id);
CREATE INDEX idx_cellar_items_quantity ON cellar_items(quantity) WHERE quantity > 0;

-- =====================================================
-- POHYBY (HISTORIE)
-- =====================================================
CREATE TABLE movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cellar_item_id UUID NOT NULL REFERENCES cellar_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('add', 'remove')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT CHECK (reason IN ('purchase', 'gift_received', 'consumed', 'gift_given', 'sold', 'broken', 'import', 'other')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  consumption_rating INTEGER CHECK (consumption_rating >= 0 AND consumption_rating <= 100),
  food_paired TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_movements_user ON movements(user_id);
CREATE INDEX idx_movements_date ON movements(date DESC);
CREATE INDEX idx_movements_cellar_item ON movements(cellar_item_id);

-- =====================================================
-- SDÍLENÍ SKLEPA
-- =====================================================
CREATE TABLE cellar_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- SMĚNNÉ KURZY
-- =====================================================
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate DECIMAL(12,6) NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(base_currency, target_currency)
);

-- Výchozí kurzy (aktualizovány Edge Function)
INSERT INTO exchange_rates (base_currency, target_currency, rate) VALUES
  ('EUR', 'CZK', 25.0),
  ('USD', 'CZK', 23.0),
  ('CZK', 'EUR', 0.04),
  ('CZK', 'USD', 0.043),
  ('EUR', 'USD', 1.08),
  ('USD', 'EUR', 0.93);

-- =====================================================
-- ZPRÁVY OD ADMINISTRÁTORA
-- =====================================================
CREATE TABLE admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID REFERENCES profiles(id),  -- NULL = všem
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('news', 'event', 'recommendation', 'system')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE admin_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES admin_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_admin_messages_recipient ON admin_messages(recipient_id);
CREATE INDEX idx_admin_messages_type ON admin_messages(message_type);
CREATE INDEX idx_admin_messages_created ON admin_messages(created_at DESC);

-- =====================================================
-- SOMMELIER HODNOCENÍ (PRIORITA NAD AUTOMATICKÝMI DATY)
-- =====================================================
CREATE TABLE sommelier_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vintage_id UUID NOT NULL REFERENCES vintages(id) ON DELETE CASCADE,
  sommelier_id UUID NOT NULL REFERENCES profiles(id),
  -- Přepsání automatické zralosti
  drink_from_override INTEGER,
  drink_until_override INTEGER,
  peak_start_override INTEGER,
  peak_end_override INTEGER,
  maturity_status TEXT CHECK (maturity_status IN ('too_young', 'can_drink', 'ideal', 'drink_soon', 'past_peak')),
  -- Degustace
  tasting_date DATE NOT NULL,
  tasting_notes TEXT NOT NULL,
  tasting_notes_cs TEXT,
  sommelier_rating INTEGER CHECK (sommelier_rating >= 0 AND sommelier_rating <= 100),
  recommendation TEXT,
  food_pairing_override TEXT[],
  food_pairing_override_cs TEXT[],
  is_verified BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(vintage_id)  -- Jedno hodnocení sommeliera na ročník
);

CREATE INDEX idx_sommelier_reviews_vintage ON sommelier_reviews(vintage_id);

-- =====================================================
-- AUDIT LOG ADMINISTRÁTORA
-- =====================================================
CREATE TABLE admin_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  target_user_id UUID REFERENCES profiles(id),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'add_wine', 'remove_wine', 'edit_wine', 'view_cellar',
    'promote_to_admin', 'send_message', 'sommelier_review'
  )),
  cellar_item_id UUID REFERENCES cellar_items(id),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_admin ON admin_actions_log(admin_id);
CREATE INDEX idx_admin_actions_target ON admin_actions_log(target_user_id);
CREATE INDEX idx_admin_actions_created ON admin_actions_log(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Helper: je uživatel admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL USING (is_admin());

-- WINES (veřejný katalog – čtení pro všechny autentizované)
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wines_read_all" ON wines FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "wines_write_admin" ON wines FOR INSERT WITH CHECK (is_admin() OR auth.uid() IS NOT NULL);
CREATE POLICY "wines_update_admin" ON wines FOR UPDATE USING (is_admin());

-- VINTAGES
ALTER TABLE vintages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vintages_read_all" ON vintages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vintages_write_auth" ON vintages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "vintages_update_admin" ON vintages FOR UPDATE USING (is_admin());

-- CELLAR ITEMS
ALTER TABLE cellar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cellar_own" ON cellar_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "cellar_admin" ON cellar_items FOR ALL USING (is_admin());

-- MOVEMENTS
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements_own" ON movements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "movements_admin" ON movements FOR ALL USING (is_admin());

-- ADMIN MESSAGES
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_read" ON admin_messages FOR SELECT USING (
  recipient_id = auth.uid() OR recipient_id IS NULL OR is_admin()
);
CREATE POLICY "messages_write_admin" ON admin_messages FOR INSERT WITH CHECK (is_admin());

-- ADMIN MESSAGE READS
ALTER TABLE admin_message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reads_own" ON admin_message_reads FOR ALL USING (auth.uid() = user_id);

-- SOMMELIER REVIEWS
ALTER TABLE sommelier_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_read_all" ON sommelier_reviews FOR SELECT USING (true);
CREATE POLICY "reviews_write_admin" ON sommelier_reviews FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "reviews_update_admin" ON sommelier_reviews FOR UPDATE USING (is_admin());

-- CELLAR SHARES
ALTER TABLE cellar_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shares_own" ON cellar_shares FOR ALL USING (auth.uid() = user_id);

-- EXCHANGE RATES (veřejné čtení)
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rates_read_all" ON exchange_rates FOR SELECT USING (true);
CREATE POLICY "rates_write_admin" ON exchange_rates FOR ALL USING (is_admin());

-- APP CONFIG (veřejné čtení)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_read_all" ON app_config FOR SELECT USING (true);
CREATE POLICY "config_write_admin" ON app_config FOR ALL USING (is_admin());

-- ADMIN LOG
ALTER TABLE admin_actions_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_admin" ON admin_actions_log FOR ALL USING (is_admin());
