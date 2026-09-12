-- 010_android_rls_write_policies.sql
-- The Android client authenticates with the anon key plus a user JWT, so
-- unlike the web app (which goes through Vercel with the service-role key
-- and bypasses RLS entirely) it is subject to row-level security.
--
-- Migration 003 added SELECT policies for song / playlist /
-- song_playlist_map and nothing else. No table has an INSERT, UPDATE or
-- DELETE policy, so every Android write would be silently discarded:
-- Postgrest returns 2xx and affects zero rows, which is worse than an
-- error because nothing surfaces.
--
-- This migration is purely additive. The web app keeps working unchanged
-- and needs no redeploy -- the service-role key still bypasses all of it.
--
-- Scoping matches backend/lib/auth.js exactly: user_id is the caller's
-- email, lowercased and trimmed. The '' guest bucket is deliberately NOT
-- writable by anyone here; it is a globally shared read-only bucket and
-- the Android client keeps guest data local.

-- Helper: the caller's normalized identity. Matches UserId.of() on Android
-- and getUserId() in the web backend.
CREATE OR REPLACE FUNCTION public.jwt_user_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT lower(trim(coalesce(auth.jwt() ->> 'email', '')))
$$;

-- =============================================================
-- song
-- =============================================================
DROP POLICY IF EXISTS "insert_own_rows" ON song;
CREATE POLICY "insert_own_rows" ON song
  FOR INSERT WITH CHECK (user_id = public.jwt_user_id() AND user_id <> '');

DROP POLICY IF EXISTS "update_own_rows" ON song;
CREATE POLICY "update_own_rows" ON song
  FOR UPDATE USING      (user_id = public.jwt_user_id() AND user_id <> '')
             WITH CHECK (user_id = public.jwt_user_id() AND user_id <> '');

DROP POLICY IF EXISTS "delete_own_rows" ON song;
CREATE POLICY "delete_own_rows" ON song
  FOR DELETE USING (user_id = public.jwt_user_id() AND user_id <> '');

-- =============================================================
-- playlist
-- =============================================================
DROP POLICY IF EXISTS "insert_own_rows" ON playlist;
CREATE POLICY "insert_own_rows" ON playlist
  FOR INSERT WITH CHECK (user_id = public.jwt_user_id() AND user_id <> '');

DROP POLICY IF EXISTS "update_own_rows" ON playlist;
CREATE POLICY "update_own_rows" ON playlist
  FOR UPDATE USING      (user_id = public.jwt_user_id() AND user_id <> '')
             WITH CHECK (user_id = public.jwt_user_id() AND user_id <> '');

DROP POLICY IF EXISTS "delete_own_rows" ON playlist;
CREATE POLICY "delete_own_rows" ON playlist
  FOR DELETE USING (user_id = public.jwt_user_id() AND user_id <> '');

-- =============================================================
-- song_playlist_map
-- =============================================================
DROP POLICY IF EXISTS "insert_own_rows" ON song_playlist_map;
CREATE POLICY "insert_own_rows" ON song_playlist_map
  FOR INSERT WITH CHECK (user_id = public.jwt_user_id() AND user_id <> '');

DROP POLICY IF EXISTS "update_own_rows" ON song_playlist_map;
CREATE POLICY "update_own_rows" ON song_playlist_map
  FOR UPDATE USING      (user_id = public.jwt_user_id() AND user_id <> '')
             WITH CHECK (user_id = public.jwt_user_id() AND user_id <> '');

DROP POLICY IF EXISTS "delete_own_rows" ON song_playlist_map;
CREATE POLICY "delete_own_rows" ON song_playlist_map
  FOR DELETE USING (user_id = public.jwt_user_id() AND user_id <> '');

-- =============================================================
-- Tables that had RLS enabled in migration 001 and never got a policy.
-- They are currently unreadable by anything except the service role.
-- Android reads lyrics (synced lyrics cache) and format (loudnessDb for
-- volume normalization), so both must actually be selectable.
-- =============================================================
DO $do$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['artist', 'album', 'format', 'lyrics', 'event',
                           'song_artist_map', 'song_album_map'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "select_own_rows" ON public.%I', t);
      EXECUTE format($f$
        CREATE POLICY "select_own_rows" ON public.%I
          FOR SELECT USING (user_id = '' OR user_id = public.jwt_user_id())
      $f$, t);

      EXECUTE format('DROP POLICY IF EXISTS "write_own_rows" ON public.%I', t);
      EXECUTE format($f$
        CREATE POLICY "write_own_rows" ON public.%I
          FOR ALL USING      (user_id = public.jwt_user_id() AND user_id <> '')
                  WITH CHECK (user_id = public.jwt_user_id() AND user_id <> '')
      $f$, t);
    END IF;
  END LOOP;
END
$do$;


-- =============================================================
-- Harden increment_play_time
--
-- The function takes p_user_id as a plain parameter and never checks it
-- against the caller, so today any authenticated user can attribute
-- listening time to any account.
--
-- The guard is deliberately written so it cannot misfire on the web app.
-- It triggers only when there is a real end-user JWT (auth.uid() is
-- non-null). The web backend calls this with the service-role key, which
-- has no auth.uid(), so it takes exactly the path it always has. Testing
-- auth.role() instead would risk raising on the web app if that setting
-- were ever absent, silently breaking play-time tracking there.
--
-- SECURITY DEFINER is needed so an authenticated user can write past RLS.
-- That also means anon could call it if left executable by PUBLIC, so
-- execution is revoked and granted back explicitly.
-- =============================================================
CREATE OR REPLACE FUNCTION increment_play_time(
  p_song_id text,
  p_user_id text,
  p_ms bigint,
  p_title text,
  p_artists text,
  p_duration text,
  p_thumbnail text,
  p_channel_id text
) RETURNS void AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL
     AND p_user_id IS DISTINCT FROM public.jwt_user_id() THEN
    RAISE EXCEPTION 'p_user_id does not match the authenticated caller';
  END IF;

  INSERT INTO song (id, user_id, title, "artistsText", "durationText",
                    "thumbnailUrl", "channelId", "totalPlayTimeMs", "lastPlayedAt")
  VALUES (p_song_id, p_user_id, p_title, p_artists, p_duration, p_thumbnail,
          p_channel_id, p_ms, (extract(epoch from now()) * 1000)::bigint)
  ON CONFLICT (id, user_id) DO UPDATE SET
    "totalPlayTimeMs" = song."totalPlayTimeMs" + EXCLUDED."totalPlayTimeMs",
    "lastPlayedAt"    = EXCLUDED."lastPlayedAt",
    "channelId"       = COALESCE(song."channelId", EXCLUDED."channelId"),
    "thumbnailUrl"    = COALESCE(song."thumbnailUrl", EXCLUDED."thumbnailUrl");
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION
  increment_play_time(text, text, bigint, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  increment_play_time(text, text, bigint, text, text, text, text, text)
  TO authenticated, service_role;

-- =============================================================
-- Realtime replication
--
-- The web app already subscribes to postgres_changes on these three
-- tables, so they are almost certainly members of the publication
-- already -- and a bare ALTER PUBLICATION ... ADD TABLE errors out on a
-- table that is already a member. Add only what is genuinely missing.
-- =============================================================
DO $do$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['song', 'playlist', 'song_playlist_map'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = t
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$do$;
