import { supabase } from "../lib/supabase.js";
import { getUserId, handlePreflight } from "../lib/auth.js";

/**
 * GET  /api/playlists          — list all playlists
 * POST /api/playlists          — create playlist
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  const userId = getUserId(req);

  // ── GET: list playlists ──────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      let query = supabase.from("playlist").select("*");
      query = query.eq("user_id", userId);
      const { data, error } = await query;
      if (error) throw error;

      const playlists = data || [];

      // For playlists with no cover picked, fall back to the artwork of the
      // first song in them rather than a stock placeholder image. Done here
      // in two queries instead of one-per-playlist from the client.
      const needsCover = playlists.filter((p) => !p.coverUrl);
      if (needsCover.length > 0) {
        const { data: maps } = await supabase
          .from("song_playlist_map")
          .select("playlist_id, song_id, position")
          .eq("user_id", userId)
          .in("playlist_id", needsCover.map((p) => p.id))
          .order("position", { ascending: true });

        const firstSongByPlaylist = {};
        (maps || []).forEach((row) => {
          if (!firstSongByPlaylist[row.playlist_id]) {
            firstSongByPlaylist[row.playlist_id] = row.song_id;
          }
        });

        const songIds = [...new Set(Object.values(firstSongByPlaylist))];
        if (songIds.length > 0) {
          const { data: songs } = await supabase
            .from("song")
            .select("id, thumbnailUrl")
            .eq("user_id", userId)
            .in("id", songIds);

          const thumbById = Object.fromEntries((songs || []).map((s) => [s.id, s.thumbnailUrl]));
          needsCover.forEach((p) => {
            p.coverUrl = thumbById[firstSongByPlaylist[p.id]] || null;
          });
        }
      }

      return res.json({ playlists });
    } catch (error) {
      console.error("❌ Error fetching playlists:", error);
      return res.status(500).json({ error: "Failed to fetch playlists" });
    }
  }

  // ── POST: create playlist ────────────────────────────────────────────────
  if (req.method === "POST") {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Playlist name is required" });
    }

    try {
      const { data, error } = await supabase
        .from("playlist")
        .insert({ user_id: userId, name: name.trim() })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, playlist: data });
    } catch (error) {
      console.error("❌ Error creating playlist:", error);
      return res.status(500).json({ error: "Failed to create playlist" });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
