import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

/**
 * Fills in durationText for songs saved without it.
 *
 * Songs added from the website's search results were stored with an empty
 * durationText, because YouTube's /search endpoint doesn't return duration —
 * it only exists on /videos under contentDetails. The app now looks it up at
 * search time; this backfills everything saved before that.
 *
 * Usage (the key is the same one in frontend/.env as VITE_YOUTUBE_API_KEY):
 *   YOUTUBE_API_KEY=... node scripts/backfill-durations.js
 *   YOUTUBE_API_KEY=... node scripts/backfill-durations.js --dry-run
 */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const API_KEY = process.env.YOUTUBE_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

function parseDuration(iso) {
  if (!iso) return "";
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";

  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);

  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function backfill() {
  if (!API_KEY) {
    console.error("❌ YOUTUBE_API_KEY is required (copy VITE_YOUTUBE_API_KEY from frontend/.env)");
    process.exit(1);
  }

  console.log(DRY_RUN ? "🔍 Dry run — nothing will be written\n" : "");
  console.log("🔄 Finding songs without a duration...");

  // Two kinds of bad values: empty, and a YouTube Music play count that the
  // Android app writes into this column ("869M plays") instead of a running
  // time. Both get replaced with the real duration. Anything already in
  // m:ss / h:mm:ss form is left alone.
  const isRealDuration = (text) => /^\d+:\d{2}(:\d{2})?$/.test((text || "").trim());

  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("song")
      .select("id, user_id, title, durationText")
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("❌ Failed to read songs:", error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    rows.push(...data.filter((r) => !isRealDuration(r.durationText)));
    if (data.length < PAGE) break;
  }

  if (rows.length === 0) {
    console.log("✅ Nothing to backfill — every song already has a duration.");
    return;
  }

  // The same video can appear for several users; look each one up once.
  const uniqueIds = [...new Set(rows.map((r) => r.id))];
  console.log(`📋 ${rows.length} row(s) across ${uniqueIds.length} unique video(s).`);

  const durations = {};
  for (let i = 0; i < uniqueIds.length; i += 50) {
    const chunk = uniqueIds.slice(i, i + 50);
    const resp = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunk.join(",")}&key=${API_KEY}`
    );

    if (!resp.ok) {
      console.error(`❌ YouTube API error ${resp.status} — stopping. ${await resp.text()}`);
      break;
    }

    const data = await resp.json();
    (data.items || []).forEach((item) => {
      const text = parseDuration(item.contentDetails?.duration || "");
      if (text) durations[item.id] = text;
    });
    console.log(`   looked up ${Math.min(i + 50, uniqueIds.length)}/${uniqueIds.length}`);
  }

  const updatable = rows.filter((r) => durations[r.id]);
  const unavailable = rows.length - updatable.length;

  console.log(`\n📝 ${updatable.length} row(s) to update` + (unavailable ? `, ${unavailable} with no data from YouTube (deleted/private videos)` : ""));

  if (DRY_RUN) {
    updatable.slice(0, 10).forEach((r) => console.log(`   ${durations[r.id].padStart(7)}  ${r.title?.slice(0, 55)}`));
    if (updatable.length > 10) console.log(`   …and ${updatable.length - 10} more`);
    return;
  }

  let updated = 0;
  for (const row of updatable) {
    // Composite primary key (id, user_id) — both are needed to target a row.
    const { error } = await supabase
      .from("song")
      .update({ durationText: durations[row.id] })
      .eq("id", row.id)
      .eq("user_id", row.user_id);

    if (error) {
      console.error(`   ❌ ${row.id}: ${error.message}`);
    } else {
      updated += 1;
    }
  }

  console.log(`\n✅ Updated ${updated} row(s).`);
}

backfill();
