import "dotenv/config"; // Loads .env before anything else
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
// Raw parser for sqlite file uploads (Vercel handles large bodies, so we configure Express too)
app.use(express.json({ limit: "20mb" }));
app.use(express.raw({ type: "application/octet-stream", limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Helper to simulate Vercel's API signature: handler(req, res)
const adaptVercelHandler = (handlerFn) => {
  return async (req, res) => {
    try {
      await handlerFn(req, res);
    } catch (err) {
      console.error("Local dev server error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  };
};

// Vercel places dynamic URL segments in `req.query`.
// Express places them in `req.params`. We map params to query so Vercel handlers work natively.
//
// Express 5's `req.query` is not a plain mutable object the way Express 4's
// was — mutating it in place via Object.assign(req.query, ...) doesn't
// reliably persist (the getter can return a fresh object on each access).
// Redefining the property outright with defineProperty forces a real,
// writable data property, so the merged value actually sticks for the
// handler that runs next.
const injectQuery = (handlerFn) => (req, res) => {
  Object.defineProperty(req, 'query', {
    value: { ...req.query, ...req.params },
    writable: true,
    configurable: true,
  });
  return adaptVercelHandler(handlerFn)(req, res);
};

// ── Import all API routes dynamically ─────────────────────────────────────
import healthHandler from "./api/health.js";
import playlistsHandler from "./api/playlists.js";
import playlistIdHandler from "./api/playlists/[id].js";
import songsHandler from "./api/songs.js";
import favoritesHandler from "./api/favorites.js";
import songPlaylistsHandler from "./api/songs/[songId]/playlists.js";
import songFavoriteHandler from "./api/songs/[songId]/favorite.js";
import songPlayHandler from "./api/songs/[songId]/play.js";
import importDatabaseHandler from "./api/import-database/[email].js";
import exportDatabaseHandler from "./api/export-database/[email].js";
import loginHandler from "./api/login/[email].js";
import logoutHandler from "./api/logout/[email].js";

// ── Mount the exact same URLs as Vercel ───────────────────────────────────
app.all("/api/health", adaptVercelHandler(healthHandler));
app.all("/api/playlists", adaptVercelHandler(playlistsHandler));
app.all("/api/songs", adaptVercelHandler(songsHandler));
app.all("/api/favorites", adaptVercelHandler(favoritesHandler));

app.all("/api/songs/:songId/playlists", injectQuery(songPlaylistsHandler));
app.all("/api/songs/:songId/favorite", injectQuery(songFavoriteHandler));
app.all("/api/songs/:songId/play", injectQuery(songPlayHandler));
app.all("/api/import-database/:email", injectQuery(importDatabaseHandler));
app.all("/api/export-database/:email", injectQuery(exportDatabaseHandler));
app.all("/api/login/:email", injectQuery(loginHandler));
app.all("/api/logout/:email", injectQuery(logoutHandler));

// The playlistIdHandler handles multiple sub-routes via req.url inspection (like Vercel rewrites)
app.all("/api/playlists/:id", injectQuery(playlistIdHandler));
app.all("/api/playlists/:id/songs", injectQuery(playlistIdHandler));
app.all("/api/playlists/:id/songs/:songId", injectQuery(playlistIdHandler));

// Fallback for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found in local dev server" });
});

app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Local Dev Server (Simulating Vercel)`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`☁️  Supabase: ${process.env.SUPABASE_URL ? 'Configured' : 'Missing .env credentials'}`);
  console.log(`${"=".repeat(60)}\n`);
});
