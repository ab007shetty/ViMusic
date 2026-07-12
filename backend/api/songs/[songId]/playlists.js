import { supabase } from "../../../lib/supabase.js";
import { getUserId, handlePreflight } from "../../../lib/auth.js";

/**
 * GET /api/songs/:songId/playlists
 * Returns all playlists that contain a given song.
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = getUserId(req);
  const songId = req.query.songId;

  try {
    // Join song_playlist_map → playlist
    let query = supabase
      .from("song_playlist_map")
      .select("playlist(*)")
      .eq("song_id", songId);
    query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;

    const playlists = (data || []).map((row) => row.playlist);
    res.json({ playlists });
  } catch (error) {
    console.error("❌ Error fetching song playlists:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
}
