/**
 * sqlite-io.js
 *
 * Import a ViMusic .db (SQLite3 binary) into Supabase Postgres,
 * and export a user's Postgres data back to a .db binary.
 *
 * Uses sql.js (WebAssembly SQLite) — no native bindings, works on Vercel.
 *
 * user_id convention:
 *   '' (empty string) = guest (matches Postgres DEFAULT '')
 *   'user@email.com'  = authenticated user
 */

import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";

// In Vercel serverless, sql.js fails to locate the .wasm file dynamically.
// We explicitly read it and pass the binary to guarantee it loads in the cloud.
const getSqlJs = async () => {
  const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const wasmBinary = fs.readFileSync(wasmPath);
  return initSqlJs({ wasmBinary });
};

// ============================================================
// IMPORT: SQLite .db binary → Supabase Postgres
// ============================================================

/**
 * Parse a SQLite database buffer and upsert all data into Postgres.
 *
 * @param {Buffer|Uint8Array} buffer - Raw SQLite file content
 * @param {string} userId            - '' for guest, email for authenticated
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {{ imported: object, errors: string[] }}
 */
export async function importSqliteDb(buffer, userId, supabase) {
  const SQL = await getSqlJs();
  const db = new SQL.Database(buffer instanceof Buffer ? new Uint8Array(buffer) : buffer);

  const stats = {};
  const errors = [];

  // ---- SONGS ----
  try {
    const rows = queryAll(db, "SELECT * FROM Song");
    if (rows.length > 0) {
      const mapped = rows.map((r) => ({
        id: r.id,
        user_id: userId,
        title: r.title,
        artistsText: r.artistsText,
        durationText: r.durationText,
        thumbnailUrl: r.thumbnailUrl,
        likedAt: r.likedAt,
        totalPlayTimeMs: r.totalPlayTimeMs ?? 0,
      }));
      const { error } = await supabase
        .from("song")
        .upsert(mapped, { onConflict: "id,user_id" });
      if (error) throw error;
      stats.songs = rows.length;
    }
  } catch (e) {
    errors.push(`Song: ${e.message}`);
  }

  // ---- PLAYLISTS ----
  // We ignore original SQLite playlist IDs (auto-increment, collision-prone).
  // Store a mapping old id → new Postgres id for SongPlaylistMap remapping.
  const playlistIdMap = {};
  try {
    const rows = queryAll(db, "SELECT * FROM Playlist");
    for (const r of rows) {
      const { data, error } = await supabase
        .from("playlist")
        .insert({ user_id: userId, name: r.name, browseId: r.browseId ?? null })
        .select("id")
        .single();
      if (error) throw error;
      playlistIdMap[r.id] = data.id;
    }
    stats.playlists = rows.length;
  } catch (e) {
    errors.push(`Playlist: ${e.message}`);
  }

  // ---- SONG_PLAYLIST_MAP ----
  try {
    const rows = queryAll(db, "SELECT * FROM SongPlaylistMap");
    if (rows.length > 0) {
      const mapped = rows
        .filter((r) => playlistIdMap[r.playlistId] !== undefined)
        .map((r) => ({
          song_id: r.songId,
          playlist_id: playlistIdMap[r.playlistId],
          user_id: userId,
          position: r.position,
        }));
      if (mapped.length > 0) {
        const { error } = await supabase
          .from("song_playlist_map")
          .upsert(mapped, { onConflict: "song_id,playlist_id" });
        if (error) throw error;
      }
      stats.songPlaylistMap = mapped.length;
    }
  } catch (e) {
    errors.push(`SongPlaylistMap: ${e.message}`);
  }

  // ---- ARTISTS ----
  try {
    const rows = queryAll(db, "SELECT * FROM Artist");
    if (rows.length > 0) {
      const mapped = rows.map((r) => ({
        id: r.id,
        user_id: userId,
        name: r.name,
        thumbnailUrl: r.thumbnailUrl,
        timestamp: r.timestamp,
        bookmarkedAt: r.bookmarkedAt,
      }));
      const { error } = await supabase
        .from("artist")
        .upsert(mapped, { onConflict: "id,user_id" });
      if (error) throw error;
      stats.artists = rows.length;
    }
  } catch (e) {
    errors.push(`Artist: ${e.message}`);
  }

  // ---- SONG_ARTIST_MAP ----
  try {
    const rows = queryAll(db, "SELECT * FROM SongArtistMap");
    if (rows.length > 0) {
      const mapped = rows.map((r) => ({
        song_id: r.songId,
        artist_id: r.artistId,
        user_id: userId,
      }));
      const { error } = await supabase
        .from("song_artist_map")
        .upsert(mapped, { onConflict: "song_id,artist_id" });
      if (error) throw error;
      stats.songArtistMap = rows.length;
    }
  } catch (e) {
    errors.push(`SongArtistMap: ${e.message}`);
  }

  // ---- ALBUMS ----
  try {
    const rows = queryAll(db, "SELECT * FROM Album");
    if (rows.length > 0) {
      const mapped = rows.map((r) => ({
        id: r.id,
        user_id: userId,
        title: r.title,
        thumbnailUrl: r.thumbnailUrl,
        year: r.year,
        authorsText: r.authorsText,
        shareUrl: r.shareUrl,
        timestamp: r.timestamp,
        bookmarkedAt: r.bookmarkedAt,
      }));
      const { error } = await supabase
        .from("album")
        .upsert(mapped, { onConflict: "id,user_id" });
      if (error) throw error;
      stats.albums = rows.length;
    }
  } catch (e) {
    errors.push(`Album: ${e.message}`);
  }

  // ---- SONG_ALBUM_MAP ----
  try {
    const rows = queryAll(db, "SELECT * FROM SongAlbumMap");
    if (rows.length > 0) {
      const mapped = rows.map((r) => ({
        song_id: r.songId,
        album_id: r.albumId,
        user_id: userId,
        position: r.position,
      }));
      const { error } = await supabase
        .from("song_album_map")
        .upsert(mapped, { onConflict: "song_id,album_id" });
      if (error) throw error;
      stats.songAlbumMap = rows.length;
    }
  } catch (e) {
    errors.push(`SongAlbumMap: ${e.message}`);
  }

  // ---- FORMAT ----
  try {
    const rows = queryAll(db, "SELECT * FROM Format");
    if (rows.length > 0) {
      const mapped = rows.map((r) => ({
        song_id: r.songId,
        user_id: userId,
        itag: r.itag,
        mimeType: r.mimeType,
        bitrate: r.bitrate,
        contentLength: r.contentLength,
        lastModified: r.lastModified,
        loudnessDb: r.loudnessDb,
      }));
      const { error } = await supabase
        .from("format")
        .upsert(mapped, { onConflict: "song_id,user_id" });
      if (error) throw error;
      stats.format = rows.length;
    }
  } catch (e) {
    errors.push(`Format: ${e.message}`);
  }

  // ---- LYRICS ----
  try {
    const rows = queryAll(db, "SELECT * FROM Lyrics");
    if (rows.length > 0) {
      const mapped = rows.map((r) => ({
        song_id: r.songId,
        user_id: userId,
        fixed: r.fixed,
        synced: r.synced,
      }));
      const { error } = await supabase
        .from("lyrics")
        .upsert(mapped, { onConflict: "song_id,user_id" });
      if (error) throw error;
      stats.lyrics = rows.length;
    }
  } catch (e) {
    errors.push(`Lyrics: ${e.message}`);
  }

  // ---- EVENTS ----
  try {
    const rows = queryAll(db, "SELECT * FROM Event");
    if (rows.length > 0) {
      const mapped = rows.map((r) => ({
        user_id: userId,
        song_id: r.songId,
        timestamp: r.timestamp,
        playTime: r.playTime,
      }));
      const { error } = await supabase.from("event").insert(mapped);
      if (error) throw error;
      stats.events = rows.length;
    }
  } catch (e) {
    errors.push(`Event: ${e.message}`);
  }

  db.close();
  return { imported: stats, errors };
}

// ============================================================
// EXPORT: Supabase Postgres → SQLite .db binary
// ============================================================

/**
 * Build an in-memory SQLite .db file from the user's Postgres data.
 *
 * @param {string} userId - '' for guest, email for authenticated user
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Buffer} - Raw SQLite file bytes
 */
export async function exportSqliteDb(userId, supabase) {
  const SQL = await getSqlJs();
  const db = new SQL.Database();

  // Create the full ViMusic schema in the in-memory db
  db.run(`
    CREATE TABLE android_metadata (locale TEXT);
    INSERT INTO android_metadata VALUES ('en_US');

    CREATE TABLE Song (
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      artistsText TEXT,
      durationText TEXT,
      thumbnailUrl TEXT,
      likedAt INTEGER,
      totalPlayTimeMs INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(id)
    );

    CREATE TABLE Playlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      browseId TEXT
    );

    CREATE TABLE SongPlaylistMap (
      songId TEXT NOT NULL,
      playlistId INTEGER NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY(songId, playlistId)
    );

    CREATE INDEX index_SongPlaylistMap_songId ON SongPlaylistMap(songId);
    CREATE INDEX index_SongPlaylistMap_playlistId ON SongPlaylistMap(playlistId);

    CREATE TABLE Artist (
      id TEXT NOT NULL,
      name TEXT,
      thumbnailUrl TEXT,
      timestamp INTEGER,
      bookmarkedAt INTEGER,
      PRIMARY KEY(id)
    );

    CREATE TABLE SongArtistMap (
      songId TEXT NOT NULL,
      artistId TEXT NOT NULL,
      PRIMARY KEY(songId, artistId)
    );

    CREATE INDEX index_SongArtistMap_songId ON SongArtistMap(songId);
    CREATE INDEX index_SongArtistMap_artistId ON SongArtistMap(artistId);

    CREATE TABLE Album (
      id TEXT NOT NULL,
      title TEXT,
      thumbnailUrl TEXT,
      year TEXT,
      authorsText TEXT,
      shareUrl TEXT,
      timestamp INTEGER,
      bookmarkedAt INTEGER,
      PRIMARY KEY(id)
    );

    CREATE TABLE SongAlbumMap (
      songId TEXT NOT NULL,
      albumId TEXT NOT NULL,
      position INTEGER,
      PRIMARY KEY(songId, albumId)
    );

    CREATE INDEX index_SongAlbumMap_songId ON SongAlbumMap(songId);
    CREATE INDEX index_SongAlbumMap_albumId ON SongAlbumMap(albumId);

    CREATE TABLE SearchQuery (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      query TEXT NOT NULL
    );

    CREATE UNIQUE INDEX index_SearchQuery_query ON SearchQuery(query);

    CREATE TABLE QueuedMediaItem (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      mediaItem BLOB NOT NULL,
      position INTEGER
    );

    CREATE TABLE Format (
      songId TEXT NOT NULL,
      itag INTEGER,
      mimeType TEXT,
      bitrate INTEGER,
      contentLength INTEGER,
      lastModified INTEGER,
      loudnessDb REAL,
      PRIMARY KEY(songId)
    );

    CREATE TABLE Event (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      songId TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      playTime INTEGER NOT NULL
    );

    CREATE INDEX index_Event_songId ON Event(songId);

    CREATE TABLE Lyrics (
      songId TEXT NOT NULL,
      fixed TEXT,
      synced TEXT,
      PRIMARY KEY(songId)
    );

    CREATE VIEW SortedSongPlaylistMap AS SELECT * FROM SongPlaylistMap ORDER BY position;

    CREATE TABLE room_master_table (id INTEGER PRIMARY KEY, identity_hash TEXT);
  `);

  // -- Fetch and insert all user data --

  // Songs
  const songs = await fetchAll(supabase, "song", userId);
  for (const s of songs) {
    db.run(
      `INSERT OR IGNORE INTO Song (id, title, artistsText, durationText, thumbnailUrl, likedAt, totalPlayTimeMs)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.title, s.artistsText, s.durationText, s.thumbnailUrl, s.likedAt, s.totalPlayTimeMs ?? 0]
    );
  }

  // Playlists — re-map IDs sequentially for the export file
  const playlists = await fetchAll(supabase, "playlist", userId);
  const playlistIdMap = {};
  let playlistSeq = 1;
  for (const p of playlists) {
    const localId = playlistSeq++;
    playlistIdMap[p.id] = localId;
    db.run(
      `INSERT INTO Playlist (id, name, browseId) VALUES (?, ?, ?)`,
      [localId, p.name, p.browseId ?? null]
    );
  }

  // SongPlaylistMap
  const spm = await fetchAll(supabase, "song_playlist_map", userId);
  for (const m of spm) {
    const localPlaylistId = playlistIdMap[m.playlist_id];
    if (!localPlaylistId) continue;
    db.run(
      `INSERT OR IGNORE INTO SongPlaylistMap (songId, playlistId, position) VALUES (?, ?, ?)`,
      [m.song_id, localPlaylistId, m.position]
    );
  }

  // Artists
  const artists = await fetchAll(supabase, "artist", userId);
  for (const a of artists) {
    db.run(
      `INSERT OR IGNORE INTO Artist (id, name, thumbnailUrl, timestamp, bookmarkedAt)
       VALUES (?, ?, ?, ?, ?)`,
      [a.id, a.name, a.thumbnailUrl, a.timestamp, a.bookmarkedAt]
    );
  }

  // SongArtistMap
  const sam = await fetchAll(supabase, "song_artist_map", userId);
  for (const m of sam) {
    db.run(
      `INSERT OR IGNORE INTO SongArtistMap (songId, artistId) VALUES (?, ?)`,
      [m.song_id, m.artist_id]
    );
  }

  // Albums
  const albums = await fetchAll(supabase, "album", userId);
  for (const a of albums) {
    db.run(
      `INSERT OR IGNORE INTO Album (id, title, thumbnailUrl, year, authorsText, shareUrl, timestamp, bookmarkedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.title, a.thumbnailUrl, a.year, a.authorsText, a.shareUrl, a.timestamp, a.bookmarkedAt]
    );
  }

  // SongAlbumMap
  const salm = await fetchAll(supabase, "song_album_map", userId);
  for (const m of salm) {
    db.run(
      `INSERT OR IGNORE INTO SongAlbumMap (songId, albumId, position) VALUES (?, ?, ?)`,
      [m.song_id, m.album_id, m.position]
    );
  }

  // Format
  const formats = await fetchAll(supabase, "format", userId);
  for (const f of formats) {
    db.run(
      `INSERT OR IGNORE INTO Format (songId, itag, mimeType, bitrate, contentLength, lastModified, loudnessDb)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [f.song_id, f.itag, f.mimeType, f.bitrate, f.contentLength, f.lastModified, f.loudnessDb]
    );
  }

  // Lyrics
  const lyrics = await fetchAll(supabase, "lyrics", userId);
  for (const l of lyrics) {
    db.run(
      `INSERT OR IGNORE INTO Lyrics (songId, fixed, synced) VALUES (?, ?, ?)`,
      [l.song_id, l.fixed, l.synced]
    );
  }

  // Events
  const events = await fetchAll(supabase, "event", userId);
  for (const e of events) {
    db.run(
      `INSERT INTO Event (songId, timestamp, playTime) VALUES (?, ?, ?)`,
      [e.song_id, e.timestamp, e.playTime]
    );
  }

  const binaryArray = db.export();
  db.close();
  return Buffer.from(binaryArray);
}

// ============================================================
// HELPERS
// ============================================================

/** Run a SELECT on the in-memory SQLite db and return plain objects. */
function queryAll(db, sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch {
    return []; // table may not exist in older .db files
  }
}

/**
 * Fetch all rows from a Supabase table for a given user.
 * '' = guest, anything else = authenticated user.
 */
async function fetchAll(supabase, table, userId) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error(`Error fetching ${table}:`, error.message);
    return [];
  }
  return data || [];
}
