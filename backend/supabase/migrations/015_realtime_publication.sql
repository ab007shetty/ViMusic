-- Publish library changes over Realtime.
--
-- Both clients already subscribe: the web app in App.jsx and the Android app
-- in LibraryRealtime. Neither has ever received an event, because
-- `supabase_realtime` is empty on a new project and nothing was ever added to
-- it. Postgres was simply not publishing, so a favourite added on the phone
-- reached the website only when something happened to refetch.
--
-- REPLICA IDENTITY FULL is needed for two separate reasons. A DELETE event
-- otherwise carries only the primary key, so a client cannot tell whose row
-- it was and has to refetch to find out. And Realtime applies its row filter
-- -- `user_id=eq.<email>` in both clients -- against the replicated record,
-- which for an UPDATE or DELETE means the old row: without the full identity
-- there is no user_id there to match, and the event is dropped as not ours.
--
-- The cost is that Postgres writes the whole old row to the WAL on every
-- update. These tables are small and written by hand, a few rows at a time,
-- so that is not a meaningful load.

alter table public.song replica identity full;
alter table public.playlist replica identity full;
alter table public.song_playlist_map replica identity full;

-- `add table` errors if the table is already published, and this migration
-- should be safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'song'
  ) then
    alter publication supabase_realtime add table public.song;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'playlist'
  ) then
    alter publication supabase_realtime add table public.playlist;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'song_playlist_map'
  ) then
    alter publication supabase_realtime add table public.song_playlist_map;
  end if;
end
$$;
