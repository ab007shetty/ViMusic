-- 009_drop_unused_tables.sql
-- search_query and queued_media_item are dead weight: no backend route
-- or frontend code ever reads or writes them, and the database export
-- never copies data into them either (the exported .db file creates
-- empty tables with these names purely to match the Android ViMusic
-- app's file schema, independent of anything in Postgres). Dropping
-- them permanently.

DROP TABLE IF EXISTS search_query;
DROP TABLE IF EXISTS queued_media_item;

-- Tidy up the cascade-delete function so it stops listing tables that
-- no longer exist (harmless either way thanks to the to_regclass guard
-- from migration 008, but no reason to keep dead entries around).
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
    'playlist', 'artist', 'album', 'format', 'lyrics', 'event', 'song'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', tbl) USING user_email;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
