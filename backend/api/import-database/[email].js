import { supabase } from "../../lib/supabase.js";
import { handlePreflight } from "../../lib/auth.js";
import { importSqliteDb } from "../../lib/sqlite-io.js";

// Vercel: allow up to 10MB body for .db file upload
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

/**
 * POST /api/import-database/:email
 *
 * Accepts a raw SQLite .db file as a base64-encoded string in JSON body:
 *   { "data": "<base64 string>" }
 *
 * OR as multipart/octet-stream raw binary body.
 *
 * Parses the file using sql.js (WebAssembly) and upserts all rows
 * into Supabase Postgres for the given user.
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = req.query.email;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const userId = email.toLowerCase().trim();

  console.log(`📥 Import database requested for: ${userId}`);

  try {
    let buffer;

    // Accept base64-encoded data in JSON body
    if (req.body && req.body.data) {
      buffer = Buffer.from(req.body.data, "base64");
    } else if (req.body && Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (req.body && typeof req.body === "string") {
      buffer = Buffer.from(req.body);
    } else {
      return res.status(400).json({
        error: "No database file provided. Send binary file, multipart, or { data: '<base64>' }",
      });
    }

    // Zero-dependency multipart/form-data extraction:
    // Search for the SQLite magic header anywhere in the buffer.
    const magicString = "SQLite format 3\0";
    const magicIdx = buffer.indexOf(magicString);
    
    if (magicIdx === -1) {
      return res.status(400).json({
        error: "Uploaded file does not contain a valid SQLite database header",
      });
    }

    // Slice from the header to the end (sql.js ignores trailing multipart boundaries safely)
    buffer = buffer.slice(magicIdx);

    console.log(`🔄 Parsing SQLite file (${(buffer.length / 1024).toFixed(1)} KB)...`);

    const result = await importSqliteDb(buffer, userId, supabase);

    console.log(`✅ Import complete for ${userId}:`, result.imported);
    if (result.errors.length > 0) {
      console.warn(`⚠️ Import warnings:`, result.errors);
    }

    res.json({
      success: true,
      message: "Database imported successfully",
      user: email,
      imported: result.imported,
      warnings: result.errors.length > 0 ? result.errors : undefined,
      requiresRefresh: true,
    });
  } catch (err) {
    console.error("❌ Import failed:", err);
    res.status(500).json({
      error: "Failed to import database",
      details: err.message,
    });
  }
}
