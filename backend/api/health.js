import { supabase } from "../lib/supabase.js";
import { handlePreflight } from "../lib/auth.js";

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  res.json({
    status: "ok",
    supabase: process.env.SUPABASE_URL ? "connected" : "not initialized",
    timestamp: new Date().toISOString(),
  });
}
