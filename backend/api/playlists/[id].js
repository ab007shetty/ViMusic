import { supabase } from "../../lib/supabase.js";
import { getUserId, handlePreflight } from "../../lib/auth.js";

/**
 * Handles all routes under /api/playlists/[id]:
 *
 *   GET    /api/playlists/:id/songs              → list songs in playlist
 *   POST   /api/playlists/:id/songs/:songId       → add song to playlist
 *   DELETE /api/playlists/:id/songs/:songId       → remove song from playlist
 *   PUT    /api/playlists/:id                     → rename playlist
 *   DELETE /api/playlists/:id                     → delete playlist
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  const userId = getUserId(req);

  // Vercel passes the full path suffix via req.url
  // e.g. /api/playlists/5/songs/abc123  →  id=5, rest=/songs/abc123
  const urlPath = req.url.split("?")[0]; // strip query
  const parts = urlPath.split("/").filter(Boolean);
  // parts = ['api', 'playlists', ':id', ...rest]
  const playlistIdStr = req.query?.id || parts[2];
  const playlistId = Number(playlistIdStr);

  if (!playlistIdStr || isNaN(playlistId)) {
    console.error("Invalid playlist id — raw query:", req.query, "parts:", parts);
    return res.status(400).json({ error: "Invalid playlist id" });
  }

  // Determine if this is a /songs or /songs/:songId sub-route
  const afterId = parts.slice(3); // everything after 'playlists/:id'
  const isSongsRoute = afterId[0] === "songs";
  let songId = afterId[1] || null;
  if (!songId || songId === "undefined") {
    songId = req.body?.songId || req.body?.id || null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/playlists/:id/songs
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "GET" && isSongsRoute && !songId) {
    try {
      let query = supabase
        .from("song_playlist_map")
        .select("song_id, position")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true });

      query = query.eq("user_id", userId);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        return res.json({ songs: [] });
      }

      const songIds = data.map((row) => row.song_id);
      
      // Fetch songs manually since there is no foreign key setup for composite PKs
      const { data: songsData, error: songsErr } = await supabase
        .from("song")
        .select("*")
        .eq("user_id", userId)
        .in("id", songIds);

      if (songsErr) throw songsErr;

      // Preserve the position ordering from the map
      const songsById = {};
      songsData.forEach(s => songsById[s.id] = s);
      const songs = data.map(row => songsById[row.song_id]).filter(Boolean);

      return res.json({ songs });
    } catch (error) {
      console.error("Error fetching playlist songs:", error);
      return res.status(500).json({ error: "Failed to fetch playlist songs" });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/playlists/:playlistId/songs/:songId
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "POST" && isSongsRoute && songId) {
    const {
      title,
      artistsText,
      channelId,
      durationText,
      thumbnailUrl,
      totalPlayTimeMs = 0,
    } = req.body || {};

    try {
      // Check existing mapping
      let existQuery = supabase
        .from("song_playlist_map")
        .select("song_id")
        .eq("song_id", songId)
        .eq("playlist_id", playlistId);
      existQuery = existQuery.eq("user_id", userId);
      const { data: existing } = await existQuery;

      if (existing && existing.length > 0) {
        return res.status(400).json({ error: "Song already in playlist" });
      }

      // Upsert song row
      const { error: songErr } = await supabase.from("song").upsert(
        {
          id: songId,
          user_id: userId,
          title: title || "",
          artistsText,
          channelId,
          durationText,
          thumbnailUrl,
          totalPlayTimeMs: totalPlayTimeMs ?? 0,
        },
        { onConflict: "id,user_id" }
      );
      if (songErr) throw songErr;

      // Get next position
      let posQuery = supabase
        .from("song_playlist_map")
        .select("position")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: false })
        .limit(1);
      posQuery = posQuery.eq("user_id", userId);
      const { data: posData } = await posQuery;
      const position = posData && posData.length > 0 ? posData[0].position + 1 : 1;

      const { error: mapErr } = await supabase.from("song_playlist_map").insert({
        song_id: songId,
        playlist_id: playlistId,
        user_id: userId,
        position,
      });
      if (mapErr) throw mapErr;

      return res.status(201).json({ success: true, position });
    } catch (error) {
      console.error("Error adding song to playlist:", error);
      return res.status(500).json({ error: "Failed to add song to playlist" });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/playlists/:playlistId/songs/:songId
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "DELETE" && isSongsRoute && songId) {
    try {
      let query = supabase
        .from("song_playlist_map")
        .delete()
        .eq("song_id", songId)
        .eq("playlist_id", playlistId);
      query = query.eq("user_id", userId);
      const { error } = await query;
      if (error) throw error;

      return res.json({ success: true, message: "Song removed from playlist" });
    } catch (error) {
      console.error("Error removing song from playlist:", error);
      return res.status(500).json({ error: "Failed to remove song" });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUT /api/playlists/:id  - rename
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "PUT" && !isSongsRoute) {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Playlist name is required" });
    }

    try {
      let query = supabase
        .from("playlist")
        .update({ name: name.trim() })
        .eq("id", playlistId);
      query = query.eq("user_id", userId);

      const { data, error } = await query.select().single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Playlist not found" });

      return res.json({ success: true, playlist: data });
    } catch (error) {
      console.error("Error updating playlist:", error);
      return res.status(500).json({ error: "Failed to update playlist" });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/playlists/:id  - delete playlist
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "DELETE" && !isSongsRoute) {
    try {
      // Remove song mappings first (FK)
      let mapQuery = supabase
        .from("song_playlist_map")
        .delete()
        .eq("playlist_id", playlistId);
      mapQuery = mapQuery.eq("user_id", userId);
      await mapQuery;

      let query = supabase.from("playlist").delete().eq("id", playlistId);
      query = query.eq("user_id", userId);
      const { error } = await query;
      if (error) throw error;

      return res.json({ success: true, message: "Playlist deleted" });
    } catch (error) {
      console.error("Error deleting playlist:", error);
      return res.status(500).json({ error: "Failed to delete playlist" });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
