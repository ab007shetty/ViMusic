import "dotenv/config";
import { supabase } from "./lib/supabase.js";

async function run() {
  let query = supabase
    .from("song_playlist_map")
    .select("playlist(*)")
    .eq("song_id", "LOyHMftfbGA")
    .eq("user_id", "ab007shetty@gmail.com");

  const { data, error } = await query;
  console.log("DB returned:", JSON.stringify(data, null, 2));
}
run();
