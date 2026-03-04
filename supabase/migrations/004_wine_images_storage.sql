-- =====================================================
-- MIGRACE 004: Storage bucket pro fotky lahví vín
-- =====================================================

-- 1. Vytvořit storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wine-images',
  'wine-images',
  true,
  2097152,  -- 2 MiB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies pro storage objects

-- Veřejné čtení (bucket je public, RLS musí také povolit)
CREATE POLICY "wine_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wine-images');

-- Zápis pouze přes service_role (Edge Function používá SUPABASE_SERVICE_ROLE_KEY)
-- Service role obchází RLS, ale pro ochranu proti frontend uploadu:
CREATE POLICY "wine_images_insert_service_only"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wine-images' AND auth.role() = 'service_role');

CREATE POLICY "wine_images_update_service_only"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'wine-images' AND auth.role() = 'service_role');

CREATE POLICY "wine_images_delete_service_only"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'wine-images' AND auth.role() = 'service_role');
