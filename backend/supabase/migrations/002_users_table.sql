-- =============================================================
-- Migration: 002_users_table.sql
-- Create public.users table and automatic auth.users trigger
-- =============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  full_name           TEXT,
  name                TEXT,
  avatar_url          TEXT,
  picture             TEXT,
  provider            TEXT DEFAULT 'google',
  google_id           TEXT,
  email_verified      BOOLEAN DEFAULT false,
  custom_claims       JSONB DEFAULT '{}'::jsonb,
  raw_user_meta_data  JSONB DEFAULT '{}'::jsonb,
  last_sign_in_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow users to read all profiles or their own profile
CREATE POLICY "Allow public read users" ON public.users
  FOR SELECT USING (true);

-- Allow authenticated users to update their own profile
CREATE POLICY "Allow individual update" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Allow service role full access
CREATE POLICY "Allow service role all" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================
-- Automatic Trigger Function: Sync auth.users -> public.users
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_auth_user_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    name,
    avatar_url,
    picture,
    provider,
    google_id,
    email_verified,
    custom_claims,
    raw_user_meta_data,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    COALESCE(NEW.raw_user_meta_data->>'picture', NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'google'),
    COALESCE(NEW.raw_user_meta_data->>'sub', NEW.raw_user_meta_data->>'provider_id', ''),
    COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, (NEW.raw_user_meta_data->>'verified_email')::boolean, false),
    COALESCE(NEW.raw_user_meta_data->'custom_claims', '{}'::jsonb),
    NEW.raw_user_meta_data,
    NEW.last_sign_in_at,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email               = EXCLUDED.email,
    full_name           = EXCLUDED.full_name,
    name                = EXCLUDED.name,
    avatar_url          = EXCLUDED.avatar_url,
    picture             = EXCLUDED.picture,
    provider            = EXCLUDED.provider,
    google_id           = EXCLUDED.google_id,
    email_verified      = EXCLUDED.email_verified,
    custom_claims       = EXCLUDED.custom_claims,
    raw_user_meta_data  = EXCLUDED.raw_user_meta_data,
    last_sign_in_at     = EXCLUDED.last_sign_in_at,
    updated_at          = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists then create
DROP TRIGGER IF EXISTS on_auth_user_created_or_updated ON auth.users;

CREATE TRIGGER on_auth_user_created_or_updated
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_change();
