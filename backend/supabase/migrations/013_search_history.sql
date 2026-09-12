-- Search history, shared between the Android app and the web app.
--
-- Migration 009 dropped an earlier `search_query` table and the Android app
-- has been keeping history device-locally ever since. This brings it back as
-- a first-class synced table so a query typed on the phone is suggested on
-- the website and the reverse.
--
-- Safe to run on a live database: it only creates a new table and its
-- policies. Nothing existing is altered or dropped.

CREATE TABLE IF NOT EXISTS search_history (
  query      TEXT   NOT NULL,
  user_id    TEXT   NOT NULL DEFAULT '',
  -- Epoch millis, matching every other timestamp in this schema (song.likedAt
  -- and friends are BIGINT millis, not timestamptz).
  "timestamp" BIGINT NOT NULL,
  PRIMARY KEY (query, user_id)
);

CREATE INDEX IF NOT EXISTS idx_search_history_user
  ON search_history (user_id, "timestamp" DESC);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- public.jwt_user_id() is defined in migration 010 and is the single place
-- the JWT-to-user_id mapping lives. Reusing it keeps this table's rules
-- identical to song/playlist rather than a second, drifting copy.
DROP POLICY IF EXISTS search_history_select ON search_history;
CREATE POLICY search_history_select ON search_history
  FOR SELECT USING (user_id = public.jwt_user_id());

DROP POLICY IF EXISTS search_history_insert ON search_history;
CREATE POLICY search_history_insert ON search_history
  FOR INSERT WITH CHECK (user_id = public.jwt_user_id());

DROP POLICY IF EXISTS search_history_update ON search_history;
CREATE POLICY search_history_update ON search_history
  FOR UPDATE USING (user_id = public.jwt_user_id())
  WITH CHECK (user_id = public.jwt_user_id());

DROP POLICY IF EXISTS search_history_delete ON search_history;
CREATE POLICY search_history_delete ON search_history
  FOR DELETE USING (user_id = public.jwt_user_id());

-- Realtime, added the same guarded way as migration 010: a bare
-- ALTER PUBLICATION ... ADD TABLE errors if the table is already a member,
-- which would abort a re-run of this file.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'search_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.search_history;
  END IF;
END
$do$;
