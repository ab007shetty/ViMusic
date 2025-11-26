import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import { startAutomaticSync } from "./scripts/syncGuestDatabase.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log("✅ Supabase client initialized");

// === PATHS ===
const DB_DIR = path.join(__dirname, "public", "database");
const GUEST_DB = path.join(DB_DIR, "vimusic.db");
const EMPTY_TEMPLATE = path.join(DB_DIR, "empty.db");
const STORAGE_BUCKET = "databases";

// Ensure directories exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log("📁 Created database directory");
}

if (!fs.existsSync(GUEST_DB)) {
  console.error(
    "❌ vimusic.db (guest) is missing! Place it in backend/public/database/"
  );
}

if (!fs.existsSync(EMPTY_TEMPLATE)) {
  console.warn("⚠️ empty.db template is missing! Will create from schema.");
}

// === DATABASE MANAGEMENT ===
let currentDbPath = GUEST_DB;
let db = null;

const initializeGuestDb = () => {
  try {
    db = new Database(currentDbPath, { readonly: false });
    console.log("✅ Guest database connected");
  } catch (error) {
    console.error("❌ Failed to connect to guest database:", error.message);
  }
};

initializeGuestDb();

const switchToDatabase = (usernameOrEmail = null) => {
  // Extract username if email is passed
  const username =
    usernameOrEmail && usernameOrEmail.includes("@")
      ? usernameOrEmail.split("@")[0]
      : usernameOrEmail;

  const newPath = username ? path.join(DB_DIR, `${username}.db`) : GUEST_DB;

  if (currentDbPath === newPath && db) {
    console.log(
      `✓ Already connected to ${username ? username : "guest"} database`
    );
    return true;
  }

  if (db) {
    try {
      db.close();
      console.log(`✓ Closed previous database`);
    } catch (error) {
      console.error("⚠️ Error closing database:", error.message);
    }
  }

  try {
    db = new Database(newPath, { readonly: false });
    currentDbPath = newPath;
    console.log(`🔄 Switched to → ${username ? `User: ${username}` : "Guest"}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to switch database:", error.message);
    try {
      db = new Database(GUEST_DB, { readonly: false });
      currentDbPath = GUEST_DB;
      console.log("↩️ Fallen back to guest database");
      return false;
    } catch (fallbackError) {
      console.error(
        "❌ Critical: Cannot open any database:",
        fallbackError.message
      );
      return false;
    }
  }
};

// === ENSURE USER DATABASE ===
const ensureUserDatabase = async (userEmail) => {
  const username = userEmail.split("@")[0];
  const localPath = path.join(DB_DIR, `${username}.db`);
  const remotePath = `${username}.db`;

  console.log(`🔍 Processing login for: ${userEmail} (using ${username}.db)`);

  if (fs.existsSync(localPath)) {
    console.log(`📂 Local database found for ${username}`);
    switchToDatabase(username);
    return { success: true, isNew: false };
  }

  console.log(`🔍 Checking if ${username}.db exists in Supabase...`);

  try {
    const { data: files, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list("", {
        search: remotePath,
      });

    if (listError) {
      console.error("❌ Error listing bucket:", listError);
      throw listError;
    }

    const fileExists = files && files.some((f) => f.name === remotePath);

    if (fileExists) {
      console.log(`✅ Found ${remotePath} in Supabase, downloading...`);

      const { data, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(remotePath);

      if (downloadError) throw downloadError;

      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(localPath, buffer);

      console.log(`✅ Downloaded existing database for ${username}`);
      switchToDatabase(username);
      return { success: true, isNew: false };
    } else {
      console.log(`🆕 NEW USER: ${username} - Creating database...`);

      if (!fs.existsSync(EMPTY_TEMPLATE)) {
        console.error("❌ empty.db template not found at:", EMPTY_TEMPLATE);
        throw new Error(
          "Server configuration error: empty.db template missing"
        );
      }

      console.log(`📋 Copying empty.db → ${username}.db`);
      fs.copyFileSync(EMPTY_TEMPLATE, localPath);
      console.log(`✅ Created local database`);

      try {
        console.log(`☁️ Uploading ${remotePath} to Supabase...`);
        const fileBuffer = fs.readFileSync(localPath);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(remotePath, fileBuffer, {
            contentType: "application/x-sqlite3",
            upsert: false,
          });

        if (uploadError) {
          console.error("❌ Upload error:", uploadError);
          throw uploadError;
        }
        console.log(`✅ Successfully uploaded to Supabase`);
      } catch (uploadErr) {
        console.error("❌ Failed to upload to Supabase:", uploadErr);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
        throw new Error(
          `Failed to upload database to cloud: ${uploadErr.message}`
        );
      }

      switchToDatabase(username);
      console.log(`✅ New user setup complete for ${username}`);
      return { success: true, isNew: true };
    }
  } catch (err) {
    console.error("❌ Error in ensureUserDatabase:", err);
    throw new Error(
      `Failed to ensure database: ${err.message || "Unknown error"}`
    );
  }
};

// === ROUTES ===

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: currentDbPath.replace(DB_DIR, ""),
    supabase: supabaseUrl ? "connected" : "not initialized",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/login/:email", async (req, res) => {
  const email = req.params.email;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    const result = await ensureUserDatabase(email);
    res.json({
      message: result.isNew ? "New database created" : "Database loaded",
      user: email,
      isNew: result.isNew,
      requiresRefresh: true,
    });
  } catch (error) {
    console.error("Error ensuring database:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to load user database" });
  }
});

app.get("/api/download-database/:email", async (req, res) => {
  const email = req.params.email;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    const result = await ensureUserDatabase(email);
    res.json({
      message: result.isNew ? "New database created" : "Database loaded",
      user: email,
      isNew: result.isNew,
      requiresRefresh: true,
    });
  } catch (error) {
    console.error("Error ensuring database:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to load user database" });
  }
});

app.post("/api/import-database/:email", async (req, res) => {
  const email = req.params.email;
  const username = email.split("@")[0];
  const localPath = path.join(DB_DIR, `${username}.db`);
  const remotePath = `${username}.db`;

  console.log(`📥 Import initiated for ${email} (using ${username}.db)`);

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(remotePath);

    if (error) throw error;

    if (currentDbPath === localPath && db) {
      try {
        db.close();
        db = null;
        console.log("✅ Closed current database");
      } catch (error) {
        console.error("⚠️ Error closing database:", error.message);
      }
    }

    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      console.log("🗑️ Deleted old local database");
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(localPath, buffer);
    console.log("💾 Saved new database locally");

    switchToDatabase(username);

    res.json({
      message: "Database imported successfully",
      user: email,
      requiresRefresh: true,
    });
  } catch (error) {
    console.error("❌ Import failed:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to import database" });
  }
});

app.post("/api/logout/:email", async (req, res) => {
  const email = req.params.email;
  const username = email.split("@")[0];
  const localPath = path.join(DB_DIR, `${username}.db`);

  console.log(`👋 Logout initiated for ${email} (using ${username}.db)`);

  if (currentDbPath === localPath && db) {
    try {
      db.close();
      db = null;
      console.log("✅ Closed user database");
    } catch (error) {
      console.error("⚠️ Error closing database:", error.message);
    }
  }

  if (fs.existsSync(localPath)) {
    try {
      const fileBuffer = fs.readFileSync(localPath);
      const remotePath = `${username}.db`;

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .update(remotePath, fileBuffer, {
          contentType: "application/x-sqlite3",
          upsert: true,
        });

      if (error) throw error;
      console.log(`☁️ Uploaded database for ${username}`);

      fs.unlinkSync(localPath);
      console.log(`🗑️ Deleted local database`);
    } catch (err) {
      console.error("❌ Logout upload failed:", err.message);
      return res.status(500).json({ error: "Failed to sync database" });
    }
  }

  switchToDatabase();
  res.json({
    message: "Logged out successfully",
    requiresRefresh: true,
  });
});

// === API ENDPOINTS ===

app.get("/api/songs", (req, res) => {
  try {
    if (!db) throw new Error("Database not initialized");
    const stmt = db.prepare(
      "SELECT * FROM Song ORDER BY totalPlayTimeMs DESC LIMIT 100"
    );
    res.json({ songs: stmt.all() });
  } catch (error) {
    console.error("Error fetching songs:", error);
    res.status(500).json({ error: "Failed to fetch songs" });
  }
});

app.get("/api/favorites", (req, res) => {
  try {
    if (!db) throw new Error("Database not initialized");
    const stmt = db.prepare(
      "SELECT * FROM Song WHERE likedAt IS NOT NULL ORDER BY likedAt DESC"
    );
    res.json({ songs: stmt.all() });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

app.get("/api/playlists", (req, res) => {
  try {
    if (!db) throw new Error("Database not initialized");
    const stmt = db.prepare("SELECT * FROM Playlist");
    res.json({ playlists: stmt.all() });
  } catch (error) {
    console.error("Error fetching playlists:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

app.get("/api/playlists/:id/songs", (req, res) => {
  try {
    if (!db) throw new Error("Database not initialized");
    const stmt = db.prepare(`
      SELECT s.* FROM Song s
      JOIN SongPlaylistMap spm ON s.id = spm.songId
      WHERE spm.playlistId = ?
      ORDER BY spm.position ASC
    `);
    res.json({ songs: stmt.all(req.params.id) });
  } catch (error) {
    console.error("Error fetching playlist songs:", error);
    res.status(500).json({ error: "Failed to fetch playlist songs" });
  }
});

app.get("/api/songs/:songId/playlists", (req, res) => {
  try {
    if (!db) throw new Error("Database not initialized");
    const stmt = db.prepare(`
      SELECT p.* FROM Playlist p
      JOIN SongPlaylistMap spm ON p.id = spm.playlistId
      WHERE spm.songId = ?
    `);
    res.json({ playlists: stmt.all(req.params.songId) });
  } catch (error) {
    console.error("Error fetching song playlists:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

app.put("/api/songs/:songId/favorite", (req, res) => {
  const { songId } = req.params;
  const {
    title,
    artistsText,
    durationText,
    thumbnailUrl,
    totalPlayTimeMs = 0,
  } = req.body;

  try {
    if (!db) throw new Error("Database not initialized");

    const song = db
      .prepare("SELECT likedAt FROM Song WHERE id = ?")
      .get(songId);

    if (song?.likedAt) {
      db.prepare("UPDATE Song SET likedAt = NULL WHERE id = ?").run(songId);
      res.json({ favorite: false });
    } else {
      if (song) {
        db.prepare("UPDATE Song SET likedAt = ? WHERE id = ?").run(
          Date.now(),
          songId
        );
      } else {
        db.prepare(
          `INSERT INTO Song (id, title, artistsText, durationText, thumbnailUrl, likedAt, totalPlayTimeMs)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          songId,
          title,
          artistsText,
          durationText,
          thumbnailUrl,
          Date.now(),
          totalPlayTimeMs
        );
      }
      res.json({ favorite: true });
    }
  } catch (error) {
    console.error("Error toggling favorite:", error);
    res.status(500).json({ error: "Failed to toggle favorite" });
  }
});

app.post("/api/playlists/:playlistId/songs/:songId", (req, res) => {
  const { playlistId, songId } = req.params;
  const {
    title,
    artistsText,
    durationText,
    thumbnailUrl,
    totalPlayTimeMs = 0,
  } = req.body;

  try {
    if (!db) throw new Error("Database not initialized");

    const existingMapping = db
      .prepare(
        "SELECT 1 FROM SongPlaylistMap WHERE songId = ? AND playlistId = ?"
      )
      .get(songId, playlistId);

    if (existingMapping) {
      return res.status(400).json({ error: "Song already in playlist" });
    }

    const exists = db.prepare("SELECT 1 FROM Song WHERE id = ?").get(songId);
    if (!exists) {
      db.prepare(
        `INSERT INTO Song (id, title, artistsText, durationText, thumbnailUrl, totalPlayTimeMs)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        songId,
        title,
        artistsText,
        durationText,
        thumbnailUrl,
        totalPlayTimeMs
      );
    }

    const max =
      db
        .prepare(
          "SELECT MAX(position) as pos FROM SongPlaylistMap WHERE playlistId = ?"
        )
        .get(playlistId)?.pos || 0;
    const position = max + 1;

    db.prepare(
      "INSERT INTO SongPlaylistMap (songId, playlistId, position) VALUES (?, ?, ?)"
    ).run(songId, playlistId, position);

    res.status(201).json({ success: true, position });
  } catch (error) {
    console.error("Error adding to playlist:", error);
    res.status(500).json({ error: "Failed to add song to playlist" });
  }
});

app.delete("/api/playlists/:playlistId/songs/:songId", (req, res) => {
  const { playlistId, songId } = req.params;

  try {
    if (!db) throw new Error("Database not initialized");

    const result = db
      .prepare(
        "DELETE FROM SongPlaylistMap WHERE playlistId = ? AND songId = ?"
      )
      .run(playlistId, songId);

    if (result.changes > 0) {
      res.json({ success: true, message: "Song removed from playlist" });
    } else {
      res.status(404).json({ error: "Song not found in playlist" });
    }
  } catch (error) {
    console.error("Error removing from playlist:", error);
    res.status(500).json({ error: "Failed to remove song" });
  }
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("\n🛑 Shutting down gracefully...");
  if (db) {
    try {
      db.close();
      console.log("✅ Database closed");
    } catch (error) {
      console.error("❌ Error closing database:", error.message);
    }
  }
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start server
app.listen(PORT, () => {
  console.log(`\n🎵 ViMusic Backend Running → http://localhost:${PORT}`);
  console.log(`📊 Database: ${currentDbPath.replace(DB_DIR, "")}`);
  console.log(`☁️ Supabase: Connected\n`);

  // Start automatic guest database sync
  startAutomaticSync();
});
