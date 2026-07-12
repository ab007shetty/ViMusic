/**
 * seed-guest-db.js
 *
 * One-time migration: reads public/database/vimusic.db (the guest SQLite file)
 * and inserts all rows into Supabase Postgres with user_id = '' (guest).
 *
 * Run ONCE before deploying:
 *   node scripts/seed-guest-db.js
 *
 * Requires .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import { importSqliteDb } from "../lib/sqlite-io.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const DB_PATH = path.join(__dirname, "../public/database/vimusic.db");

async function main() {
  console.log("🌱 Starting guest database seed...");
  console.log(`📂 Source: ${DB_PATH}`);

  let buffer;
  try {
    buffer = readFileSync(DB_PATH);
  } catch (e) {
    console.error(`❌ Cannot read ${DB_PATH}:`, e.message);
    process.exit(1);
  }

  console.log(`📦 File size: ${(buffer.length / 1024).toFixed(1)} KB`);
  console.log("⏳ Importing into Supabase Postgres (user_id = '' = guest)...\n");

  const result = await importSqliteDb(buffer, "", supabase);

  console.log("\n✅ Seed complete!");
  console.log("📊 Imported:");
  for (const [table, count] of Object.entries(result.imported)) {
    console.log(`   ${table}: ${count} rows`);
  }

  if (result.errors.length > 0) {
    console.warn("\n⚠️  Warnings:");
    result.errors.forEach((e) => console.warn(`   ${e}`));
  }

  console.log(
    "\n🎉 Guest data is now in Postgres. You can safely delete vimusic.db from public/database/."
  );
}

main().catch((e) => {
  console.error("❌ Unexpected error:", e);
  process.exit(1);
});
