import { supabase } from "./supabase.js";
import { getUserId, handlePreflight } from "./auth.js";

/**
 * POST /api/songs/:songId/play
 * Atomically adds `incrementMs` of listening time to this song for the
 * current user, upserting the song row if it doesn't exist yet (a song
 * doesn't need to be favorited to accumulate play time).
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    title,
    artistsText,
    channelId,
    durationText,
    thumbnailUrl,
    incrementMs,
    userEmail, // fallback identity for navigator.sendBeacon(), which can't set headers
  } = req.body;

  // sendBeacon() (used for the final flush on tab close) cannot attach
  // custom headers, so X-User-Email will be absent on that path — fall back
  // to a body-supplied email in that case only. This is no weaker than the
  // rest of the app's trust model: every route here already trusts a
  // client-supplied X-User-Email header with no cryptographic verification.
  const userId = getUserId(req) || (userEmail ? String(userEmail).toLowerCase().trim() : "");
  const songId = req.query.songId || req.body.songId;

  const ms = Number(incrementMs);
  if (!songId || !Number.isFinite(ms) || ms <= 0) {
    return res.status(400).json({ error: "songId and a positive incrementMs are required" });
  }

  try {
    const { error } = await supabase.rpc("increment_play_time", {
      p_song_id: songId,
      p_user_id: userId,
      p_ms: Math.round(ms),
      p_title: title || "",
      p_artists: artistsText || null,
      p_duration: durationText || null,
      p_thumbnail: thumbnailUrl || null,
      p_channel_id: channelId || null,
    });
    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error incrementing play time:", error);
    res.status(500).json({ error: "Failed to record play time" });
  }
}
