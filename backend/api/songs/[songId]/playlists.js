import { supabase } from "../../../lib/supabase.js";
import { getUserId, handlePreflight } from "../../../lib/auth.js";

/**
 * GET /api/songs/:songId/playlists
 * Returns all playlists that contain a given song.
 *
 * songId extraction priority:
 *   1. req.query.songId  (set by injectQuery middleware in local dev via req.params)
 *   2. Parse from req.url path manually (fallback for Vercel / direct routing)
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = getUserId(req);

  // Robust songId extraction
  let songId = req.query?.songId;
  if (!songId) {
    // Parse from URL: /api/songs/<songId>/playlists
    const urlPath = (req.url || "").split("?")[0];
    const parts = urlPath.split("/").filter(Boolean);
    // parts = ['api', 'songs', '<songId>', 'playlists']
    songId = parts[2];
  }

  if (!songId) {
    return res.status(400).json({ error: "songId is required" });
  }

  try {
    const { data, error } = await supabase
      .from("song_playlist_map")
      .select("playlist(*)")
      .eq("song_id", songId)
      .eq("user_id", userId);

    if (error) throw error;

    const playlists = (data || []).map((row) => row.playlist).filter(Boolean);
    res.json({ playlists });
  } catch (error) {
    console.error("❌ Error fetching song playlists:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
}
