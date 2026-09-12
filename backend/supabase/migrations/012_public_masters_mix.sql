-- 012_public_masters_mix.sql
--
-- Makes the curated "Master's Mix" account readable by signed-out clients.
--
-- The web app already shows this to every anonymous visitor: its guest view
-- fetches ab007shetty@gmail.com's favourites and playlists (see the
-- X-User-Email fallback in frontend/src/App.jsx). It gets away with no
-- policy because it reads through Vercel with the service-role key, which
-- bypasses RLS entirely.
--
-- The Android app connects as anon with no JWT, so RLS applies and it can
-- see nothing at all -- which is why a signed-out phone shows an empty
-- library where the website shows a curated one.
--
-- This exposes exactly what the website already exposes publicly, and only
-- that: SELECT, one account, three tables. No write access, no other user's
-- rows, nothing that was previously private.
--
-- To retire the guest experience, drop these three policies.

DO $do$
DECLARE
  curator TEXT := 'ab007shetty@gmail.com';
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['song', 'playlist', 'song_playlist_map'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "select_masters_mix" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "select_masters_mix" ON public.%I FOR SELECT USING (user_id = %L)',
      t, curator
    );
  END LOOP;
END
$do$;
