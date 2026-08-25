-- 004_play_tracking.sql
-- Adds artist-grouping and recency columns to `song`, plus an atomic
-- upsert-increment function so concurrent play-time updates for the same
-- song can't race each other with a naive read-then-write from the API.

ALTER TABLE song ADD COLUMN IF NOT EXISTS "channelId" TEXT;
ALTER TABLE song ADD COLUMN IF NOT EXISTS "lastPlayedAt" BIGINT;

CREATE OR REPLACE FUNCTION increment_play_time(
  p_song_id text,
  p_user_id text,
  p_ms bigint,
  p_title text,
  p_artists text,
  p_duration text,
  p_thumbnail text,
  p_channel_id text
) RETURNS void AS $$
  INSERT INTO song (id, user_id, title, "artistsText", "durationText", "thumbnailUrl", "channelId", "totalPlayTimeMs", "lastPlayedAt")
  VALUES (p_song_id, p_user_id, p_title, p_artists, p_duration, p_thumbnail, p_channel_id, p_ms, (extract(epoch from now()) * 1000)::bigint)
  ON CONFLICT (id, user_id) DO UPDATE SET
    "totalPlayTimeMs" = song."totalPlayTimeMs" + EXCLUDED."totalPlayTimeMs",
    "lastPlayedAt" = EXCLUDED."lastPlayedAt",
    "channelId" = COALESCE(song."channelId", EXCLUDED."channelId"),
    "thumbnailUrl" = COALESCE(song."thumbnailUrl", EXCLUDED."thumbnailUrl");
$$ LANGUAGE sql;
