import { supabase } from "../lib/supabase.js";
import { getUserId, handlePreflight } from "../lib/auth.js";

/**
 * GET /api/songs
 * Returns top 100 songs by play time for the authenticated user (or guest).
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = getUserId(req);

  try {
    let query = supabase
      .from("song")
      .select("*")
      .order("totalPlayTimeMs", { ascending: false })
      .limit(100);

    query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ songs: data || [] });
  } catch (error) {
    console.error("❌ Error fetching songs:", error);
    res.status(500).json({ error: "Failed to fetch songs" });
  }
}
