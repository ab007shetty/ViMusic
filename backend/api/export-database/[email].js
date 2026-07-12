import { supabase } from "../../lib/supabase.js";
import { handlePreflight } from "../../lib/auth.js";
import { exportSqliteDb } from "../../lib/sqlite-io.js";

// Vercel: disable body parsing since we return binary
export const config = {
  api: {
    bodyParser: false,
    responseLimit: "20mb",
  },
};

/**
 * GET /api/export-database/:email
 *
 * Reads all user data from Supabase Postgres, builds a valid ViMusic
 * SQLite .db file in-memory using sql.js (WebAssembly), and returns
 * it as a binary download.
 *
 * The resulting file is compatible with the ViMusic Android app.
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = req.query.email;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const userId = email.toLowerCase().trim();

  console.log(`📤 Export database requested for: ${userId}`);

  try {
    const buffer = await exportSqliteDb(userId, supabase);

    const filename = `vimusic_${email.split("@")[0]}_${Date.now()}.db`;

    res.setHeader("Content-Type", "application/x-sqlite3");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-cache, no-store");

    console.log(`✅ Exported ${(buffer.length / 1024).toFixed(1)} KB for ${userId}`);
    res.send(buffer);
  } catch (err) {
    console.error("❌ Export failed:", err);
    res.status(500).json({
      error: "Failed to export database",
      details: err.message,
    });
  }
}
