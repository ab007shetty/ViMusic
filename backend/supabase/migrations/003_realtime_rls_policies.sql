-- 003_realtime_rls_policies.sql
-- Adds SELECT policies so Supabase Realtime's postgres_changes feature can
-- actually deliver events to the frontend's anon-key client. RLS was enabled
-- on these tables in 001_vimusic_schema.sql with zero policies defined,
-- which silently denies all reads (including Realtime's row-visibility
-- check) to any role except the backend's service-role key.
--
-- '' (empty string) user_id is the documented shared guest bucket (see the
-- comment at the top of 001_vimusic_schema.sql) — intentionally readable by
-- anyone. All other rows are scoped to the caller's own authenticated email,
-- matching how backend/lib/auth.js normalizes user_id (lowercased, trimmed).

CREATE POLICY "select_own_rows" ON song
  FOR SELECT USING (
    user_id = '' OR user_id = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY "select_own_rows" ON playlist
  FOR SELECT USING (
    user_id = '' OR user_id = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY "select_own_rows" ON song_playlist_map
  FOR SELECT USING (
    user_id = '' OR user_id = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
