import { supabase } from "../lib/supabase.js";
import { getUserId, handlePreflight } from "../lib/auth.js";

/**
 * GET    /api/search-history          — recent queries for this user, newest first
 * POST   /api/search-history          — record a query (upserts the timestamp if repeated)
 * DELETE /api/search-history          — clear all history, or one query via ?query=
 *
 * Backed by the `search_history` table added in the Android app's
 * migration 013, shared by both clients. Guests are skipped entirely by
 * the frontend — there is no meaningful personal history for the shared
 * '' bucket, matching how favorites/playlists already treat guests.
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in required" });
  }

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("search_history")
        .select("query, timestamp")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(15);
      if (error) throw error;
      return res.json({ history: data || [] });
    } catch (error) {
      console.error("❌ Error fetching search history:", error);
      return res.status(500).json({ error: "Failed to fetch search history" });
    }
  }

  if (req.method === "POST") {
    const query = (req.body?.query || "").trim();
    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    try {
      const { error } = await supabase
        .from("search_history")
        .upsert(
          { query, user_id: userId, timestamp: Date.now() },
          { onConflict: "query,user_id" }
        );
      if (error) throw error;
      return res.status(201).json({ success: true });
    } catch (error) {
      console.error("❌ Error saving search history:", error);
      return res.status(500).json({ error: "Failed to save search history" });
    }
  }

  if (req.method === "DELETE") {
    const query = req.query?.query || req.body?.query;

    try {
      let del = supabase.from("search_history").delete().eq("user_id", userId);
      if (query) del = del.eq("query", query);
      const { error } = await del;
      if (error) throw error;
      return res.json({ success: true });
    } catch (error) {
      console.error("❌ Error deleting search history:", error);
      return res.status(500).json({ error: "Failed to delete search history" });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
