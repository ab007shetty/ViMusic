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
      return res.json({ playlists: data || [] });
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
