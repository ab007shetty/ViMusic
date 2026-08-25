-- 006_cascade_delete_user_data.sql
-- Deleting a row from public.users now permanently deletes ALL of that
-- user's data across every table: song (favorites/most-played/recently-
-- played), playlist, song_playlist_map, artist, album, song_artist_map,
-- song_album_map, format, lyrics, event, search_query, queued_media_item.
--
-- Why a trigger instead of a real foreign key: user_id in those tables is
-- a plain TEXT email address, not a foreign key to public.users.id (a
-- UUID) — there is no FK relationship to hang ON DELETE CASCADE off of.
-- This trigger reproduces the same effect by deleting everywhere that
-- user_id matches the deleted user's email.
--
-- THIS IS IRREVERSIBLE. Once installed, deleting a public.users row —
-- however that happens (SQL, the Supabase Table Editor UI, a future
-- "delete my account" feature) — permanently wipes that user's entire
-- library with no undo. There is no soft-delete or trash here.
--
-- Guardrail: the '' (empty string) user_id is the documented shared guest
-- bucket, not a real account — this trigger explicitly refuses to touch it
-- even if public.users somehow ever had a row with an empty email.

CREATE OR REPLACE FUNCTION public.cascade_delete_user_data()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT := lower(trim(OLD.email));
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RETURN OLD;
  END IF;

  DELETE FROM song_playlist_map WHERE user_id = user_email;
  DELETE FROM song_artist_map   WHERE user_id = user_email;
  DELETE FROM song_album_map    WHERE user_id = user_email;
  DELETE FROM playlist          WHERE user_id = user_email;
  DELETE FROM artist            WHERE user_id = user_email;
  DELETE FROM album             WHERE user_id = user_email;
  DELETE FROM format            WHERE user_id = user_email;
  DELETE FROM lyrics            WHERE user_id = user_email;
  DELETE FROM event             WHERE user_id = user_email;
  DELETE FROM search_query      WHERE user_id = user_email;
  DELETE FROM queued_media_item WHERE user_id = user_email;
  DELETE FROM song              WHERE user_id = user_email;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_deleted_cascade ON public.users;

CREATE TRIGGER on_user_deleted_cascade
  AFTER DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_user_data();
