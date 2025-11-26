// syncGuestDatabase.js - Place this in backend/scripts/
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cron from "node-cron";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase Client with SERVICE ROLE KEY (important!)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GUEST_DB_PATH = path.join(__dirname, "../public/database/vimusic.db");
const STORAGE_BUCKET = "databases";
const REMOTE_GUEST_PATH = "guest.db";

/**
 * Upload guest database to Supabase Storage
 */
async function syncGuestDatabase() {
  console.log("\n🔄 Starting guest database sync...");
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);

  try {
    // Check if guest database exists
    if (!fs.existsSync(GUEST_DB_PATH)) {
      throw new Error(`Guest database not found at: ${GUEST_DB_PATH}`);
    }

    // Read the database file
    const fileBuffer = fs.readFileSync(GUEST_DB_PATH);
    const fileSizeInMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);

    console.log(`📂 Database file size: ${fileSizeInMB} MB`);
    console.log(`☁️  Uploading to Supabase Storage...`);

    // Upload to Supabase Storage (upsert = overwrite if exists)
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(REMOTE_GUEST_PATH, fileBuffer, {
        contentType: "application/x-sqlite3",
        upsert: true, // This will overwrite existing file
      });

    if (error) {
      throw error;
    }

    console.log(`✅ Guest database synced successfully!`);
    console.log(`📍 Path: ${STORAGE_BUCKET}/${REMOTE_GUEST_PATH}`);
    console.log(`📦 Size: ${fileSizeInMB} MB`);

    return { success: true, size: fileSizeInMB };
  } catch (error) {
    console.error("❌ Error syncing guest database:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Manual trigger function (for testing)
 */
export async function manualSync() {
  console.log("🔧 Manual sync triggered");
  const result = await syncGuestDatabase();

  if (result.success) {
    console.log("\n✅ Manual sync completed successfully\n");
  } else {
    console.log("\n❌ Manual sync failed\n");
  }

  return result;
}

/**
 * Schedule automatic daily sync at 12:00 AM (midnight)
 * Cron format: second minute hour day month weekday
 * "0 0 0 * * *" = Every day at 00:00:00 (midnight)
 */
export function startAutomaticSync() {
  console.log("🤖 Starting automatic guest database sync service...");
  console.log("⏰ Scheduled to run daily at 12:00 AM (midnight)");

  // Run immediately on startup (optional)
  console.log("\n🚀 Running initial sync on startup...");
  syncGuestDatabase();

  // Schedule daily sync at midnight
  cron.schedule("0 0 0 * * *", () => {
    console.log("\n⏰ Scheduled sync triggered");
    syncGuestDatabase();
  });

  console.log("✅ Automatic sync service started\n");
}

// If running this file directly (for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  manualSync().then(() => {
    console.log("Done!");
    process.exit(0);
  });
}
