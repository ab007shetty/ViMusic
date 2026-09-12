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
  const orderColumn = req.query.orderBy === "lastPlayedAt" ? "lastPlayedAt" : "totalPlayTimeMs";

  // Page through the library instead of returning everything at once — the
  // frontend requests 20 at a time and asks for more as the user scrolls.
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  try {
    let query = supabase
      .from("song")
      .select("*")
      .order(orderColumn, { ascending: false })
      .range(offset, offset + limit - 1);

    query = query.eq("user_id", userId);

    // "totalPlayTimeMs" defaults to 0 and is never null, so filtering on
    // "is not null" doesn't actually exclude untouched songs — it would
    // return every favorited/tracked song tied at zero. Require it to be
    // positive instead, so Most Played only shows songs you've actually
    // spent time listening to. "lastPlayedAt" genuinely defaults to null,
    // so the null-filter is correct as-is for Recently Played.
    if (orderColumn === "lastPlayedAt") {
      query = query.not("lastPlayedAt", "is", null);
    } else {
      query = query.gt("totalPlayTimeMs", 0);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ songs: data || [], hasMore: (data || []).length === limit });
  } catch (error) {
    console.error("❌ Error fetching songs:", error);
    res.status(500).json({ error: "Failed to fetch songs" });
  }
}
