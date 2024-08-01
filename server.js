const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const port = 5000;

// Use the CORS middleware
app.use(cors());

// Path to the database
const dbPath = path.join(__dirname, '/database/vimusic.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// API endpoint to Most played songs
app.get('/api/songs', (req, res) => {
 const sql = "SELECT * FROM song WHERE totalPlayTimeMs IS NOT NULL ORDER BY totalPlayTimeMs DESC LIMIT 100";

  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ songs: rows });
  });
});


// Fetch all playlists
app.get('/api/playlists', (req, res) => {
  const sql = 'SELECT * FROM Playlist'; // Adjust the table name if different
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ playlists: rows });
  });
});

// Fetch songs for a specific playlist
app.get('/api/playlists/:playlistId/songs', (req, res) => {
  const { playlistId } = req.params;
	const sql = `
	  SELECT s.*
	  FROM Song s
	  INNER JOIN SongPlaylistMap spm ON s.id = spm.songId
	  WHERE spm.playlistId = ?
	  ORDER BY spm.position ASC
	`;
  db.all(sql, [playlistId], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ songs: rows });
  });
});

// API endpoint to fetch favorite songs
app.get('/api/favorites', (req, res) => {
  const sql = `
    SELECT * FROM Song
    WHERE likedAt IS NOT NULL
    ORDER BY likedAt DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ songs: rows });
  });
});

// Serve static files (for your frontend)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
