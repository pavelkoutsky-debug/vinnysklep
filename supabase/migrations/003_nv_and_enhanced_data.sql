-- =====================================================
-- MIGRACE 003: NV vína + rozšířené informace o víně
-- =====================================================

-- 1. Podpora Non-Vintage (NV) vín
--    year = 0 je sentinel hodnota pro "Non-Vintage"
ALTER TABLE vintages DROP CONSTRAINT IF EXISTS vintages_year_check;
ALTER TABLE vintages ADD CONSTRAINT vintages_year_check
  CHECK (year = 0 OR (year >= 1900 AND year <= 2200));

-- 2. Senzorický profil vína (JSONB – flexible struktura)
--    Obsahuje: aroma, taste, finish, body, tannins, acidity
ALTER TABLE wines ADD COLUMN IF NOT EXISTS sensory_profile JSONB;

-- 3. Historie vinařství (krátký text česky)
ALTER TABLE wines ADD COLUMN IF NOT EXISTS winery_history_cs TEXT;

-- 4. Expert hodnocení na úrovni ročníku
--    Průměr z Decanter / Wine Spectator / Wine Advocate
ALTER TABLE vintages ADD COLUMN IF NOT EXISTS expert_rating_avg DECIMAL(4,1)
  CHECK (expert_rating_avg IS NULL OR (expert_rating_avg >= 0 AND expert_rating_avg <= 100));

-- 5. Text s detailem hodnocení od expertů
--    Např. "Decanter: 95, WS: 93, WA: 96"
ALTER TABLE vintages ADD COLUMN IF NOT EXISTS expert_rating_text TEXT;
