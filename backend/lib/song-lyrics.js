import { supabase } from "./supabase.js";
import { getUserId } from "./auth.js";

/**
 * GET /api/songs/:songId/lyrics?title=&artist=&duration=
 *
 * Returns { plain, synced: [{ timeMs, text }] } for a song.
 *
 * Deliberately a port of the Android app's LyricsRepository so both clients
 * resolve the same track to the same lyrics, and so they share one cache:
 * results are stored in the `lyrics` table keyed by (song_id, user_id), which
 * the Android client also reads and writes. A song fetched on the phone
 * therefore costs nothing here, and vice versa.
 *
 * Proxied through the backend rather than called from the browser because the
 * cache lives behind the service-role key, and because it keeps lrclib.net out
 * of the frontend's CSP connect-src.
 */

const LRCLIB = "https://lrclib.net/api";
const MAX_DURATION_DRIFT_SECONDS = 30;

// lrclib asks callers to identify themselves.
const UA = "ViMusic-Web (https://vimusic.vercel.app)";

// Words that pad out upload titles but never appear in a catalogue entry.
const NOISE = "official|video|audio|lyric(?:s|al)?|full|song|hd|4k|remaster(?:ed)?|visuali[sz]er|mv";

// Strip the noise YouTube titles carry, so the title stands a chance of
// matching: "(Official Video)", "[4K Remaster]", anything after a pipe, and a
// bare trailing descriptor — film-song uploads in particular append it after a
// dash rather than in brackets, as in "Kesariya - Full Video | Brahmastra".
const cleanForSearch = (text) =>
  (text || "")
    .replace(new RegExp(`\\([^)]*(?:${NOISE})[^)]*\\)`, "gi"), "")
    .replace(new RegExp(`\\[[^\\]]*(?:${NOISE})[^\\]]*\\]`, "gi"), "")
    .split("|")[0]
    .replace(new RegExp(`\\s*[-–—]\\s*(?:(?:${NOISE})\\s*)+$`, "i"), "")
    .trim();

const asArtistName = (text) =>
  cleanForSearch((text || "").replace(/ - Topic$/, "").replace(/VEVO$/i, ""));

const hasLyrics = (row) =>
  Boolean(str(row, "plainLyrics") || str(row, "syncedLyrics"));

function str(obj, key) {
  const value = obj?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed !== "null" ? value : null;
}

export function parseLrc(raw) {
  if (!raw || !raw.trim()) return [];
  const pattern = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s?(.*)$/;

  return raw
    .split(/\r?\n/)
    .map((line) => {
      const match = pattern.exec(line.trim());
      if (!match) return null;
      const [, min, sec, frac = "", text] = match;
      // A fraction is hundredths in most files but can be tenths or
      // milliseconds; scale by its length rather than assuming.
      const fracMs =
        frac.length === 0 ? 0 : frac.length === 1 ? Number(frac) * 100 : frac.length === 2 ? Number(frac) * 10 : Number(frac);
      return {
        timeMs: Number(min) * 60000 + Number(sec) * 1000 + fracMs,
        text: text.trim(),
      };
    })
    .filter((line) => line && line.text)
    .sort((a, b) => a.timeMs - b.timeMs);
}

async function lrclibGet(path, params) {
  const url = `${LRCLIB}${path}?${new URLSearchParams(params)}`;
  try {
    const resp = await fetch(url, { headers: { "User-Agent": UA } });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null; // a lyrics miss must never fail the request
  }
}

const exact = async (track, performer) => {
  const row = await lrclibGet("/get", { track_name: track, artist_name: performer });
  return row && hasLyrics(row) ? row : null;
};

const bestMatch = (rows, durationSeconds) => {
  const candidates = (Array.isArray(rows) ? rows : []).filter(hasLyrics);
  if (!candidates.length) return null;

  // Rank by how close each take's length is to ours. Entries outside the drift
  // window sink to the bottom rather than dropping out, so one imperfect match
  // still beats showing nothing.
  const ranked = candidates
    .map((row) => {
      const length = Number(row.duration);
      const drift =
        durationSeconds && Number.isFinite(length)
          ? Math.abs(length - durationSeconds)
          : Infinity;
      return { row, drift, inWindow: drift <= MAX_DURATION_DRIFT_SECONDS };
    })
    .sort((a, b) => a.drift - b.drift);

  const inWindow = ranked.filter((c) => c.inWindow);
  const pool = inWindow.length ? inWindow : ranked;

  // A timed take is worth more than a marginally closer untimed one.
  return (pool.find((c) => str(c.row, "syncedLyrics")) || pool[0]).row;
};

const query = async (q, durationSeconds) =>
  bestMatch(await lrclibGet("/search", { q }), durationSeconds);

async function search(title, artist, durationSeconds) {
  const track = cleanForSearch(title);
  const performer = asArtistName(artist);

  // The exact /get endpoint often answers with an untimed transcription even
  // when timed ones exist in the catalogue, so a plain-only hit doesn't end
  // the search — it's held as a fallback while the remaining steps look for a
  // timed take. Only a timed result short-circuits.
  let untimed = null;
  const consider = (row) => {
    if (!row) return null;
    if (str(row, "syncedLyrics")) return row;
    untimed = untimed || row;
    return null;
  };

  if (performer) {
    const hit = consider(await exact(track, performer));
    if (hit) return hit;
  }

  // Plenty of uploads are titled "Artist - Track" with a channel name that
  // isn't the artist, so try splitting the title itself.
  const split = /^(.{2,60}?)\s+-\s+(.+)$/.exec(track);
  if (split) {
    const hit = consider(await exact(split[2].trim(), split[1].trim()));
    if (hit) return hit;
  }

  const byTitle = consider(await query(track, durationSeconds));
  if (byTitle) return byTitle;

  if (performer) {
    const byTitleAndArtist = consider(await query(`${track} ${performer}`, durationSeconds));
    if (byTitleAndArtist) return byTitleAndArtist;
  }

  return untimed;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = getUserId(req);
  const { title = "", artist = "", duration = "" } = req.query;

  // Vercel fills req.query from the path; parse /api/songs/<songId>/lyrics
  // by hand for any routing path that doesn't.
  const songId =
    req.query?.songId ||
    (req.url || "").split("?")[0].split("/").filter(Boolean)[2];

  if (!songId) {
    return res.status(400).json({ error: "songId is required" });
  }

  try {
    const { data: cached } = await supabase
      .from("lyrics")
      .select("fixed, synced")
      .eq("song_id", songId)
      .eq("user_id", userId)
      .maybeSingle();

    if (cached && (cached.fixed || cached.synced)) {
      return res.json({ plain: cached.fixed || null, synced: parseLrc(cached.synced), cached: true });
    }

    if (!title.trim()) {
      return res.json({ plain: null, synced: [], cached: false });
    }

    const durationSeconds = Number(duration) > 0 ? Math.round(Number(duration)) : null;
    const found = await search(title, artist, durationSeconds);

    const plain = found ? str(found, "plainLyrics") : null;
    const syncedRaw = found ? str(found, "syncedLyrics") : null;

    if (!plain && !syncedRaw) {
      return res.json({ plain: null, synced: [], cached: false });
    }

    // Guests share the '' bucket, so caching for them would leak one
    // visitor's lookups into everyone else's library.
    if (userId) {
      const { error } = await supabase
        .from("lyrics")
        .upsert({ song_id: songId, user_id: userId, fixed: plain, synced: syncedRaw }, { onConflict: "song_id,user_id" });
      if (error) console.error("Error caching lyrics:", error.message);
    }

    return res.json({ plain, synced: parseLrc(syncedRaw), cached: false });
  } catch (error) {
    console.error("❌ Error fetching lyrics:", error);
    return res.status(500).json({ error: "Failed to fetch lyrics" });
  }
}
