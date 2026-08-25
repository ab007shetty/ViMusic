-- 008_fix_cascade_missing_tables.sql
-- Fixes "Database error deleting user" when deleting from Authentication.
--
-- Root cause: migration 006's cascade function unconditionally ran
-- DELETE FROM against every table from the original Android ViMusic
-- schema (artist, album, song_artist_map, song_album_map, format,
-- lyrics, event, search_query, queued_media_item) — tables the running
-- app never actually reads or writes. If any of those were never
-- actually created in this database, that DELETE throws
-- "relation ... does not exist", which aborts the whole transaction
-- and Supabase Auth surfaces it as the generic "Database error
-- deleting user".
--
-- Fix: only DELETE from a table if it actually exists (to_regclass
-- check). A table that doesn't exist obviously holds no data for
-- anyone, so skipping it is safe — this doesn't weaken the cascade,
-- it just stops it from crashing on tables that were never created.

CREATE OR REPLACE FUNCTION public.cascade_delete_user_data()
RETURNS TRIGGER AS $$
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
    'search_query', 'queued_media_item', 'song'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', tbl) USING user_email;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
