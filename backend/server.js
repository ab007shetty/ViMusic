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

// === DATABASE FUNCTIONS ===
// Helper function to get database path for a user
const getDatabasePath = (username) => {
  if (
    !username ||
    username === "guest" ||
    username === "null" ||
    username === "undefined"
  ) {
    console.log(`📂 Using GUEST database: ${GUEST_DB}`);
    return GUEST_DB;
  }
  const userPath = path.join(DB_DIR, `${username}.db`);
  console.log(`📂 Using USER database: ${userPath}`);
  return userPath;
};

// Helper function to open database - creates NEW connection each time
const openDatabaseForRequest = (username) => {
  const dbPath = getDatabasePath(username);
  const key = username || "guest";

  console.log(`🔓 Opening NEW database connection for: ${key}`);

  // Check if database file exists
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database file not found: ${dbPath}`);
    if (key !== "guest") {
      console.log(`⚠️ Falling back to GUEST database`);
      return openDatabaseForRequest(null);
    }
    throw new Error(`Guest database not found at ${dbPath}`);
  }

  try {
    // Create a NEW database connection for this specific request
    const db = new Database(dbPath, { readonly: false, fileMustExist: true });
    console.log(`✅ Database opened successfully: ${path.basename(dbPath)}`);
    return db;
  } catch (error) {
    console.error(`❌ Failed to open database ${dbPath}:`, error.message);
    if (key !== "guest") {
      console.log(`⚠️ Falling back to GUEST database`);
      return openDatabaseForRequest(null);
    }
    throw error;
  }
};

// === MIDDLEWARE: Extract user and attach database ===
const attachDatabase = (req, res, next) => {
  // Extract user email from header (only from header, not query/body for security)
  const userEmail = req.headers["x-user-email"] || null;

  // Extract username from email
  const username = userEmail ? userEmail.split("@")[0] : null;

  // Log the request
  const userIdentifier = username || "GUEST";
  console.log(`\n${"=".repeat(60)}`);
  console.log(`👤 REQUEST: ${req.method} ${req.path}`);
  console.log(`📧 User Email Header: ${userEmail || "NOT PROVIDED"}`);
  console.log(`👤 Identified User: ${userIdentifier}`);
  console.log(`${"=".repeat(60)}`);

  // Store user info on request object
  req.username = username;
  req.userEmail = userEmail;
  req.userIdentifier = userIdentifier;

  // Open database for THIS specific request
  try {
    console.log(`🔄 Attaching database for user: ${userIdentifier}`);
    req.userDb = openDatabaseForRequest(username);
    console.log(`✅ Database successfully attached to request`);
  } catch (error) {
    console.error(`❌ CRITICAL: Failed to attach database:`, error);
    return res.status(500).json({
      error: "Database connection failed",
      details: error.message,
    });
  }

  // CRITICAL: Ensure database is closed when response finishes
  res.on("finish", () => {
    if (req.userDb) {
      try {
        req.userDb.close();
        console.log(`🔒 Database closed for: ${userIdentifier}`);
      } catch (error) {
        console.error(
          `⚠️ Error closing database for ${userIdentifier}:`,
          error.message
        );
      }
    }
  });

  // Handle errors during request processing
  res.on("error", () => {
    if (req.userDb) {
      try {
        req.userDb.close();
        console.log(
          `🔒 Database closed (error handler) for: ${userIdentifier}`
        );
      } catch (error) {
        console.error(
          `⚠️ Error in error handler closing database:`,
          error.message
        );
      }
    }
  });

  next();
};

// Apply middleware to all API routes except login/logout/health
app.use((req, res, next) => {
  // Skip middleware for these endpoints
  if (
    req.path.startsWith("/api/login") ||
    req.path.startsWith("/api/logout") ||
    req.path.startsWith("/api/sync-database") ||
    req.path === "/api/health"
  ) {
    return next();
  }

  // Apply database attachment middleware
  attachDatabase(req, res, next);
});

// === ENSURE USER DATABASE ===
const ensureUserDatabase = async (userEmail) => {
  const username = userEmail.split("@")[0];
  const localPath = path.join(DB_DIR, `${username}.db`);
  const remotePath = `${username}.db`;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔍 PROCESSING LOGIN FOR: ${userEmail}`);
  console.log(`📁 Local path: ${localPath}`);
  console.log(`☁️ Remote path: ${remotePath}`);
  console.log(`${"=".repeat(60)}\n`);

  if (fs.existsSync(localPath)) {
    console.log(`✅ Local database found for ${username}`);
    return { success: true, isNew: false };
  }

  console.log(`🔍 Checking Supabase for ${remotePath}...`);

  try {
    const { data: files, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list("", { search: remotePath });

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
      return { success: true, isNew: false };
    } else {
      console.log(`🆕 NEW USER: Creating database for ${username}...`);

      if (!fs.existsSync(EMPTY_TEMPLATE)) {
        throw new Error(
          "Server configuration error: empty.db template missing"
        );
      }

      fs.copyFileSync(EMPTY_TEMPLATE, localPath);
      console.log(`✅ Created local database from template`);

      const fileBuffer = fs.readFileSync(localPath);
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(remotePath, fileBuffer, {
          contentType: "application/x-sqlite3",
          upsert: false,
        });

      if (uploadError) {
        console.error("❌ Upload error:", uploadError);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
        throw uploadError;
      }

      console.log(`✅ Uploaded new database to Supabase`);
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
    supabase: supabaseUrl ? "connected" : "not initialized",
    guestDbExists: fs.existsSync(GUEST_DB),
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
    console.error("❌ Login error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to load user database" });
  }
});

// Sync database to cloud (without logging out)
app.post("/api/sync-database/:email", async (req, res) => {
  const email = req.params.email;
  const username = email.split("@")[0];
  const localPath = path.join(DB_DIR, `${username}.db`);

  console.log(`🔄 Sync initiated for ${email}`);

  if (!fs.existsSync(localPath)) {
    return res.status(404).json({ error: "Local database not found" });
  }

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

    console.log(`☁️ Synced database for ${username}`);
    res.json({
      message: "Database synced successfully",
      success: true,
    });
  } catch (err) {
    console.error("❌ Sync failed:", err.message);
    res.status(500).json({ error: "Failed to sync database" });
  }
});

app.post("/api/logout/:email", async (req, res) => {
  const email = req.params.email;
  const username = email.split("@")[0];
  const localPath = path.join(DB_DIR, `${username}.db`);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`👋 LOGOUT: ${email}`);
  console.log(`${"=".repeat(60)}\n`);

  // Upload to Supabase and delete local file
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
      console.log(`🗑️ Deleted local database for ${username}`);
    } catch (err) {
      console.error("❌ Logout sync failed:", err.message);
      return res.status(500).json({ error: "Failed to sync database" });
    }
  }

  res.json({
    message: "Logged out successfully",
    requiresRefresh: true,
  });
});

// === API ENDPOINTS ===
app.get("/api/songs", (req, res) => {
  try {
    console.log(`📊 Fetching songs for: ${req.userIdentifier}`);
    const db = req.userDb;
    const stmt = db.prepare(
      "SELECT * FROM Song ORDER BY totalPlayTimeMs DESC LIMIT 100"
    );
    const songs = stmt.all();
    console.log(`✅ Returning ${songs.length} songs`);
    res.json({ songs });
  } catch (error) {
    console.error("❌ Error fetching songs:", error);
    res.status(500).json({ error: "Failed to fetch songs" });
  }
});

app.get("/api/favorites", (req, res) => {
  try {
    console.log(`❤️ Fetching favorites for: ${req.userIdentifier}`);
    const db = req.userDb;
    const stmt = db.prepare(
      "SELECT * FROM Song WHERE likedAt IS NOT NULL ORDER BY likedAt DESC"
    );
    const songs = stmt.all();
    console.log(`✅ Returning ${songs.length} favorites`);
    res.json({ songs });
  } catch (error) {
    console.error("❌ Error fetching favorites:", error);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

app.get("/api/playlists", (req, res) => {
  try {
    console.log(`📋 Fetching playlists for: ${req.userIdentifier}`);
    const db = req.userDb;
    const stmt = db.prepare("SELECT * FROM Playlist");
    const playlists = stmt.all();
    console.log(`✅ Returning ${playlists.length} playlists`);
    res.json({ playlists });
  } catch (error) {
    console.error("❌ Error fetching playlists:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

app.get("/api/playlists/:id/songs", (req, res) => {
  try {
    console.log(
      `📋 Fetching playlist ${req.params.id} songs for: ${req.userIdentifier}`
    );
    const db = req.userDb;
    const stmt = db.prepare(`
      SELECT s.*
      FROM Song s
      JOIN SongPlaylistMap spm ON s.id = spm.songId
      WHERE spm.playlistId = ?
      ORDER BY spm.position ASC
    `);
    const songs = stmt.all(req.params.id);
    console.log(`✅ Returning ${songs.length} playlist songs`);
    res.json({ songs });
  } catch (error) {
    console.error("❌ Error fetching playlist songs:", error);
    res.status(500).json({ error: "Failed to fetch playlist songs" });
  }
});

app.get("/api/songs/:songId/playlists", (req, res) => {
  try {
    const db = req.userDb;
    const stmt = db.prepare(`
      SELECT p.*
      FROM Playlist p
      JOIN SongPlaylistMap spm ON p.id = spm.playlistId
      WHERE spm.songId = ?
    `);
    res.json({ playlists: stmt.all(req.params.songId) });
  } catch (error) {
    console.error("❌ Error fetching song playlists:", error);
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
    console.log(
      `❤️ Toggling favorite for: ${req.userIdentifier} - Song: ${songId}`
    );
    const db = req.userDb;
    const song = db
      .prepare("SELECT likedAt FROM Song WHERE id = ?")
      .get(songId);

    if (song?.likedAt) {
      db.prepare("UPDATE Song SET likedAt = NULL WHERE id = ?").run(songId);
      console.log(`✅ Removed from favorites`);
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
      console.log(`✅ Added to favorites`);
      res.json({ favorite: true });
    }
  } catch (error) {
    console.error("❌ Error toggling favorite:", error);
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
    const db = req.userDb;
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
    console.error("❌ Error adding to playlist:", error);
    res.status(500).json({ error: "Failed to add song to playlist" });
  }
});

app.delete("/api/playlists/:playlistId/songs/:songId", (req, res) => {
  const { playlistId, songId } = req.params;

  try {
    const db = req.userDb;
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
    console.error("❌ Error removing from playlist:", error);
    res.status(500).json({ error: "Failed to remove song" });
  }
});

// Create new playlist - UPDATED TO USE AUTO-INCREMENT ID
app.post("/api/playlists", (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Playlist name is required" });
  }

  try {
    console.log(`📋 Creating playlist for: ${req.userIdentifier}`);
    const db = req.userDb;

    // Let SQLite auto-increment the ID
    const stmt = db.prepare("INSERT INTO Playlist (name) VALUES (?)");
    const result = stmt.run(name.trim());

    const playlistId = result.lastInsertRowid; // Get the auto-generated ID

    console.log(`✅ Playlist created: ${name} (ID: ${playlistId})`);
    res.status(201).json({
      success: true,
      playlist: {
        id: playlistId,
        name: name.trim(),
      },
    });
  } catch (error) {
    console.error("❌ Error creating playlist:", error);
    res.status(500).json({
      error: "Failed to create playlist",
      details: error.message,
    });
  }
});

// Update playlist name
app.put("/api/playlists/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Playlist name is required" });
  }

  try {
    console.log(`📋 Updating playlist ${id} for: ${req.userIdentifier}`);
    const db = req.userDb;

    const result = db
      .prepare("UPDATE Playlist SET name = ? WHERE id = ?")
      .run(name.trim(), id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    console.log(`✅ Playlist updated: ${name}`);
    res.json({ success: true, playlist: { id, name: name.trim() } });
  } catch (error) {
    console.error("❌ Error updating playlist:", error);
    res.status(500).json({ error: "Failed to update playlist" });
  }
});

// Delete playlist
app.delete("/api/playlists/:id", (req, res) => {
  const { id } = req.params;

  try {
    console.log(`📋 Deleting playlist ${id} for: ${req.userIdentifier}`);
    const db = req.userDb;

    // Delete playlist songs mapping first
    db.prepare("DELETE FROM SongPlaylistMap WHERE playlistId = ?").run(id);

    // Delete playlist
    const result = db.prepare("DELETE FROM Playlist WHERE id = ?").run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    console.log(`✅ Playlist deleted`);
    res.json({ success: true, message: "Playlist deleted" });
  } catch (error) {
    console.error("❌ Error deleting playlist:", error);
    res.status(500).json({ error: "Failed to delete playlist" });
  }
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("\n🛑 Shutting down gracefully...");
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start server
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🎵 ViMusic Backend Server Started`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`☁️ Supabase: Connected`);
  console.log(`📁 Database Directory: ${DB_DIR}`);
  console.log(`📂 Guest Database: ${GUEST_DB}`);
  console.log(`${"=".repeat(60)}\n`);

  // Verify guest database exists
  if (fs.existsSync(GUEST_DB)) {
    console.log(`✅ Guest database found: ${GUEST_DB}\n`);
  } else {
    console.error(`❌ WARNING: Guest database NOT found: ${GUEST_DB}\n`);
  }

  startAutomaticSync();
});
