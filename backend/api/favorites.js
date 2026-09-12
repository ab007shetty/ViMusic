import { supabase } from "../lib/supabase.js";
import { getUserId, handlePreflight } from "../lib/auth.js";

/**
 * GET /api/favorites
 * Returns all liked songs (likedAt IS NOT NULL) ordered by liked date.
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = getUserId(req);

  // ?idsOnly=1 returns just the favorited song ids, unpaginated. Search
  // results come from YouTube and carry no likedAt, so the client needs the
  // whole set to know which of them are already favorited. Ids are small
  // enough that fetching all of them costs far less than a lookup per card.
  if (req.query.idsOnly) {
    try {
      const ids = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("song")
          .select("id")
          .not("likedAt", "is", null)
          .eq("user_id", userId)
          .range(from, from + PAGE - 1);

        if (error) throw error;
        if (!data?.length) break;
        ids.push(...data.map((r) => r.id));
        if (data.length < PAGE) break;
      }
      return res.json({ ids });
    } catch (error) {
      console.error("❌ Error fetching favorite ids:", error);
      return res.status(500).json({ error: "Failed to fetch favorite ids" });
    }
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  try {
    let query = supabase
      .from("song")
      .select("*")
      .not("likedAt", "is", null)
      .order("likedAt", { ascending: false })
      .range(offset, offset + limit - 1);

    query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ songs: data || [], hasMore: (data || []).length === limit });
  } catch (error) {
    console.error("❌ Error fetching favorites:", error);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
}
