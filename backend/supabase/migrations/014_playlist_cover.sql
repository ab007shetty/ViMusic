-- Playlist cover art, shared between the Android app and the web app.
--
-- The Android app already lets you long-press a song and use its artwork as
-- a playlist's cover, but the column lived only in Room, so the choice never
-- left the phone. This is the shared home for it: the value is a thumbnail
-- URL taken from one of the playlist's songs, so it costs one text column
-- and no storage.
--
-- Quoted camelCase to match the existing columns in this schema
-- ("thumbnailUrl" on song, "browseId" on playlist) rather than introducing a
-- second naming convention in the same table.
--
-- Safe to run on a live database: adding a nullable column rewrites nothing
-- and existing rows read as NULL, which is exactly "no cover chosen".

ALTER TABLE playlist
  ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;

COMMENT ON COLUMN playlist."coverUrl" IS
  'Thumbnail URL of the song chosen as this playlist''s cover art. NULL means '
  'no cover has been picked and the client should fall back to its own '
  'generated tile.';
