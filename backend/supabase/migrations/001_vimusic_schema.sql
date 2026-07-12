-- ViMusic PostgreSQL Schema Migration
-- Run this in the Supabase SQL Editor once before deploying
--
-- Strategy: user_id TEXT NOT NULL DEFAULT ''
--   '' (empty string) = guest / unauthenticated user
--   'user@email.com'  = authenticated user
-- This lets us use clean composite PRIMARY KEYs without COALESCE hacks.

-- =============================================================
-- SONG
-- =============================================================
CREATE TABLE IF NOT EXISTS song (
  id                TEXT   NOT NULL,
  user_id           TEXT   NOT NULL DEFAULT '',
  title             TEXT   NOT NULL,
  "artistsText"     TEXT,
  "durationText"    TEXT,
  "thumbnailUrl"    TEXT,
  "likedAt"         BIGINT,
  "totalPlayTimeMs" BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id, user_id)
);

-- =============================================================
-- PLAYLIST
-- =============================================================
CREATE TABLE IF NOT EXISTS playlist (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT   NOT NULL DEFAULT '',
  name       TEXT   NOT NULL,
  "browseId" TEXT
);

CREATE INDEX IF NOT EXISTS idx_playlist_user_id ON playlist(user_id);

-- =============================================================
-- SONG_PLAYLIST_MAP
-- =============================================================
CREATE TABLE IF NOT EXISTS song_playlist_map (
  song_id     TEXT    NOT NULL,
  playlist_id INTEGER NOT NULL REFERENCES playlist(id) ON DELETE CASCADE,
  user_id     TEXT    NOT NULL DEFAULT '',
  position    INTEGER NOT NULL,
  PRIMARY KEY (song_id, playlist_id)
);

CREATE INDEX IF NOT EXISTS idx_spm_song_id     ON song_playlist_map(song_id);
CREATE INDEX IF NOT EXISTS idx_spm_playlist_id ON song_playlist_map(playlist_id);
CREATE INDEX IF NOT EXISTS idx_spm_user_id     ON song_playlist_map(user_id);

-- =============================================================
-- ARTIST
-- =============================================================
CREATE TABLE IF NOT EXISTS artist (
  id             TEXT   NOT NULL,
  user_id        TEXT   NOT NULL DEFAULT '',
  name           TEXT,
  "thumbnailUrl" TEXT,
  "timestamp"    BIGINT,
  "bookmarkedAt" BIGINT,
  PRIMARY KEY (id, user_id)
);

-- =============================================================
-- SONG_ARTIST_MAP
-- =============================================================
CREATE TABLE IF NOT EXISTS song_artist_map (
  song_id   TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  user_id   TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (song_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_sam_song_id   ON song_artist_map(song_id);
CREATE INDEX IF NOT EXISTS idx_sam_artist_id ON song_artist_map(artist_id);

-- =============================================================
-- ALBUM
-- =============================================================
CREATE TABLE IF NOT EXISTS album (
  id             TEXT   NOT NULL,
  user_id        TEXT   NOT NULL DEFAULT '',
  title          TEXT,
  "thumbnailUrl" TEXT,
  year           TEXT,
  "authorsText"  TEXT,
  "shareUrl"     TEXT,
  "timestamp"    BIGINT,
  "bookmarkedAt" BIGINT,
  PRIMARY KEY (id, user_id)
);

-- =============================================================
-- SONG_ALBUM_MAP
-- =============================================================
CREATE TABLE IF NOT EXISTS song_album_map (
  song_id  TEXT    NOT NULL,
  album_id TEXT    NOT NULL,
  user_id  TEXT    NOT NULL DEFAULT '',
  position INTEGER,
  PRIMARY KEY (song_id, album_id)
);

CREATE INDEX IF NOT EXISTS idx_salm_song_id  ON song_album_map(song_id);
CREATE INDEX IF NOT EXISTS idx_salm_album_id ON song_album_map(album_id);

-- =============================================================
-- SEARCH_QUERY
-- =============================================================
CREATE TABLE IF NOT EXISTS search_query (
  id      SERIAL PRIMARY KEY,
  user_id TEXT   NOT NULL DEFAULT '',
  query   TEXT   NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sq_user_query ON search_query(user_id, query);

-- =============================================================
-- QUEUED_MEDIA_ITEM
-- =============================================================
CREATE TABLE IF NOT EXISTS queued_media_item (
  id          SERIAL  PRIMARY KEY,
  user_id     TEXT    NOT NULL DEFAULT '',
  "mediaItem" BYTEA   NOT NULL,
  position    INTEGER
);

-- =============================================================
-- FORMAT
-- =============================================================
CREATE TABLE IF NOT EXISTS format (
  song_id         TEXT    NOT NULL,
  user_id         TEXT    NOT NULL DEFAULT '',
  itag            INTEGER,
  "mimeType"      TEXT,
  bitrate         BIGINT,
  "contentLength" BIGINT,
  "lastModified"  BIGINT,
  "loudnessDb"    REAL,
  PRIMARY KEY (song_id, user_id)
);

-- =============================================================
-- EVENT
-- =============================================================
CREATE TABLE IF NOT EXISTS event (
  id          SERIAL  PRIMARY KEY,
  user_id     TEXT    NOT NULL DEFAULT '',
  song_id     TEXT    NOT NULL,
  "timestamp" BIGINT  NOT NULL,
  "playTime"  BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_song_id ON event(song_id);
CREATE INDEX IF NOT EXISTS idx_event_user_id ON event(user_id);

-- =============================================================
-- LYRICS
-- =============================================================
CREATE TABLE IF NOT EXISTS lyrics (
  song_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  fixed   TEXT,
  synced  TEXT,
  PRIMARY KEY (song_id, user_id)
);

-- =============================================================
-- ROW-LEVEL SECURITY
-- Service role key bypasses RLS entirely — all scoping is done
-- in query filters on the server side.
-- =============================================================
ALTER TABLE song              ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_playlist_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist            ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_artist_map   ENABLE ROW LEVEL SECURITY;
ALTER TABLE album             ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_album_map    ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_query      ENABLE ROW LEVEL SECURITY;
ALTER TABLE queued_media_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE format            ENABLE ROW LEVEL SECURITY;
ALTER TABLE event             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lyrics            ENABLE ROW LEVEL SECURITY;
