-- =====================================================
-- MIGRACE 004: Revert image feature (v0.9.0 → v0.8)
-- =====================================================

-- Odstranit sloupec image_fetched_at (přidaný v migrace 005)
ALTER TABLE wines DROP COLUMN IF EXISTS image_fetched_at;

-- Vyčistit image_url data (sloupec existoval od v0.8, necháme ho jako NULL)
UPDATE wines SET image_url = NULL;

-- Storage bucket wine-images: necháváme (prázdný, nelze smazat přes SQL).
-- Případně smazat ručně v Supabase Dashboard → Storage.
