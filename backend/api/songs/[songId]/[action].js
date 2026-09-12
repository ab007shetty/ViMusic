import { handlePreflight } from "../../../lib/auth.js";
import favorite from "../../../lib/song-favorite.js";
import play from "../../../lib/song-play.js";
import playlists from "../../../lib/song-playlists.js";

/**
 * Dispatches /api/songs/:songId/:action
 *
 *   PUT    /api/songs/:songId/favorite   → toggle like
 *   POST   /api/songs/:songId/play       → add listening time
 *   GET    /api/songs/:songId/playlists  → playlists containing this song
 *
 * These were three separate files, which Vercel counts as three separate
 * serverless functions. The Hobby plan allows 12 per deployment and this
 * backend had 13, so they share one dynamic route instead. The handlers
 * themselves live in lib/ — only files under api/ count toward the limit.
 */
const ACTIONS = { favorite, play, playlists };

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  // Vercel fills req.query from the path; fall back to parsing the URL for
  // any routing path that doesn't (the local dev server, chiefly).
  const action =
    req.query?.action ||
    req.url.split("?")[0].split("/").filter(Boolean).pop();

  const route = ACTIONS[action];
  if (!route) {
    return res.status(404).json({ error: `Unknown song action: ${action}` });
  }

  return route(req, res);
}
