-- =====================================================
-- OPRAVA: handle_new_user trigger
-- Problémy v 001:
--   1. INSERT bez ON CONFLICT → selhání při opakované registraci
--   2. Dotaz na app_config může selhat pokud tabulka/záznam neexistuje
-- =====================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  admin_email TEXT := 'pavel.koutsky@gmail.com';
BEGIN
  -- Bezpečnější: zkus načíst z app_config, fallback na hardcoded hodnotu
  BEGIN
    SELECT TRIM(BOTH '"' FROM value::TEXT)
    INTO admin_email
    FROM app_config
    WHERE key = 'initial_admin_email';
  EXCEPTION WHEN OTHERS THEN
    admin_email := 'pavel.koutsky@gmail.com';
  END;

  IF admin_email IS NULL THEN
    admin_email := 'pavel.koutsky@gmail.com';
  END IF;

  IF NEW.email = admin_email THEN
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
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email     = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      role      = EXCLUDED.role,
      updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
