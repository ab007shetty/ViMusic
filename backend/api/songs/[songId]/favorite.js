import { supabase } from "../../../lib/supabase.js";
import { getUserId, handlePreflight } from "../../../lib/auth.js";

/**
 * PUT /api/songs/:songId/favorite
 * Toggle like/unlike a song. Creates the song row if it doesn't exist.
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = getUserId(req);
  const songId = req.query.songId;
  const {
    title,
    artistsText,
    durationText,
    thumbnailUrl,
    totalPlayTimeMs = 0,
  } = req.body;

  try {
    // Fetch existing song
    let fetchQuery = supabase
      .from("song")
      .select("likedAt")
      .eq("id", songId);
    fetchQuery = fetchQuery.eq("user_id", userId);
    const { data: existing } = await fetchQuery.maybeSingle();

    if (existing?.likedAt) {
      // Currently liked → unlike
      let updateQuery = supabase
        .from("song")
        .update({ likedAt: null })
        .eq("id", songId);
      updateQuery = updateQuery.eq("user_id", userId);
      const { error } = await updateQuery;
      if (error) throw error;
      return res.json({ favorite: false });
    } else if (existing) {
      // Exists but not liked → like
      let updateQuery = supabase
        .from("song")
        .update({ likedAt: Date.now() })
        .eq("id", songId);
      updateQuery = updateQuery.eq("user_id", userId);
      const { error } = await updateQuery;
      if (error) throw error;
      return res.json({ favorite: true });
    } else {
      // Song doesn't exist → insert with likedAt
      const { error } = await supabase.from("song").insert({
        id: songId,
        user_id: userId,
        title: title || "",
        artistsText,
        durationText,
        thumbnailUrl,
        likedAt: Date.now(),
        totalPlayTimeMs: totalPlayTimeMs ?? 0,
      });
      if (error) throw error;
      return res.json({ favorite: true });
    }
  } catch (error) {
    console.error("❌ Error toggling favorite:", error);
    return res.status(500).json({ error: "Failed to toggle favorite" });
  }
}
