# Supabase migrations

One numbered sequence, 001 onwards, for Supabase project `efqmlgjtbqnoloueubgw`. Both clients
share this database: the web app in this repo, and the Android app in `../ViMusicAndroid/`.

010–015 were written for the Android app and lived in that repo for a while. They are here now
because the schema is shared — 013, 014 and 015 are read and written by both clients — and a
schema split across two repositories is a schema nobody can read in order.

## Applying them

There is no migration runner. Paste each file into the Supabase SQL editor in numeric order.
Everything here is additive and idempotent; nothing requires a web redeploy.

| File | What it does |
|---|---|
| `001_vimusic_schema.sql` | Core tables |
| `002_users_table.sql` | `users` |
| `003_realtime_rls_policies.sql` | Enables RLS, adds SELECT policies |
| `004_play_tracking.sql` | `increment_play_time` and play counters |
| `005_reset_most_played.sql` | Resets accumulated play time |
| `006`–`008` | User-delete cascades |
| `009_drop_unused_tables.sql` | Drops the old `search_query` table |
| `010_android_rls_write_policies.sql` | INSERT/UPDATE/DELETE policies; SELECT policies for five tables that had none; hardens `increment_play_time` |
| `011_playback_state.sql` | `playback_state` table for cross-device resume |
| `012_public_masters_mix.sql` | Makes the curated account readable by signed-out clients |
| `013_search_history.sql` | Search history, synced between both clients |
| `014_playlist_cover.sql` | Playlist cover art, shared between both clients |
| `015_realtime_publication.sql` | Adds the library tables to `supabase_realtime` |
| `016_add_search_history_to_cascade.sql` | Includes search history in the user-delete cascade |

## Why 010 matters

Migration 003 enabled row-level security and added **SELECT policies only**. No table had an
INSERT, UPDATE or DELETE policy.

The web app never hit this, because it writes through Vercel with the **service-role key**,
which bypasses RLS entirely. Android authenticates with the anon key plus a user JWT and does
not bypass it.

The failure mode is the bad kind: Postgrest returns **2xx with zero rows affected**. No error,
no exception, no log line. Favourites silently do not save.

010 also closes a hole that affected the web app: `increment_play_time` took `p_user_id` as a
plain parameter and never checked it against the caller, so any authenticated user could
attribute listening time to anyone's account. The rewritten function asserts the parameter
matches the JWT, exempting the service role so nothing on the web side changes.

## Why 015 matters

Both clients subscribe to Realtime — the web app in `App.jsx`, Android in `LibraryRealtime` —
and neither received anything for months. `supabase_realtime` is empty on a new project and
nothing had been added to it, so Postgres was simply not publishing.

## Verifying 010 landed

```sql
SELECT tablename, cmd, count(*) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('song', 'playlist', 'song_playlist_map')
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
GROUP BY tablename, cmd;
```

Nine rows — INSERT, UPDATE and DELETE for each of the three tables. Zero rows means it did not
apply.

Then confirm the hardening bites. As an authenticated non-service-role user:

```sql
SELECT increment_play_time('testvid', 'someone-else@example.com', 1000, 't', null, null, null, null);
```

Expect `ERROR: p_user_id does not match the authenticated caller`.

Finally, open the deployed web app, favourite a song and refresh. It should persist exactly as
before — the service role bypasses everything 010 adds. That step exists to prove it rather
than assume it.
