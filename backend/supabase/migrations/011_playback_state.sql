-- 011_playback_state.sql
-- Cross-device resume: one row per user recording where they last were.
-- Written by the Android client (throttled to at most every 10s while
-- playing, plus on pause, track change and service stop). The web app can
-- adopt it later; this table existing does not require it to.

CREATE TABLE IF NOT EXISTS playback_state (
  user_id     TEXT   PRIMARY KEY,
  song_id     TEXT   NOT NULL,
  position_ms BIGINT NOT NULL DEFAULT 0,
  updated_at  BIGINT NOT NULL
);

ALTER TABLE playback_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_rows" ON playback_state;
CREATE POLICY "select_own_rows" ON playback_state
  FOR SELECT USING (user_id = public.jwt_user_id());

DROP POLICY IF EXISTS "write_own_rows" ON playback_state;
CREATE POLICY "write_own_rows" ON playback_state
  FOR ALL USING      (user_id = public.jwt_user_id() AND user_id <> '')
          WITH CHECK (user_id = public.jwt_user_id() AND user_id <> '');

-- Migration 009's cascade function iterates a hardcoded table list, so add
-- this table to it or deleting a user leaves an orphan row behind.
CREATE OR REPLACE FUNCTION public.cascade_delete_user_data()
RETURNS TRIGGER AS $fn$
DECLARE
  user_email TEXT := lower(trim(OLD.email));
  tbl TEXT;
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RETURN OLD;
  END IF;

  FOREACH tbl IN ARRAY ARRAY[
    'song_playlist_map', 'song_artist_map', 'song_album_map',
    'playlist', 'artist', 'album', 'format', 'lyrics', 'event',
    'playback_state', 'song'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', tbl) USING user_email;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;
