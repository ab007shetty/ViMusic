-- 016_add_search_history_to_cascade.sql
-- The Android app's migration 013 added search_history but never re-added
-- it to cascade_delete_user_data() (last touched by migration 011, which
-- added playback_state). Without this, deleting a user leaves their
-- search_history rows behind — contradicting the full cascade set up in
-- migrations 006/008/009/011.
--
-- This function is shared by both apps' migration folders since they run
-- against the same database; whichever of 011/013/this one runs last wins,
-- so this is written to be safe to apply regardless of order.

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
    'playback_state', 'search_history', 'song'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', tbl) USING user_email;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
