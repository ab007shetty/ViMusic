import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import admin from 'firebase-admin';
import { getApps, initializeApp as adminInitializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express
const server = express();
const port = 5000;

// Enable CORS
server.use(cors());
server.use(express.json());

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

  adminInitializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'vimusic4abshetty.appspot.com',
  });
}

// Firebase Admin Storage Bucket
const bucket = getStorage().bucket();

// FUNCTIONS BEGIN =======================================================================================================

// Ensure 'public/database' directory exists, create if not
const ensureDatabaseDirExists = () => {
  const databaseDir = path.join(__dirname, 'public', 'database');
  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
    console.log(`Created directory: ${databaseDir}`);
  }
};

// Function to dynamically create a SQLite connection based on user status
const getDatabaseConnection = (userEmail = null) => {
  const defaultDbPath = path.join(__dirname, 'public', 'database', 'vimusic.db');

  const dbPath = userEmail
    ? path.join(__dirname, 'public', 'database', `${userEmail}.db`)
    : defaultDbPath;

  console.log(`Connecting to database: ${dbPath}`);

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err);
    } else {
      console.log(`Connected to database: ${dbPath}`);
    }
  });

  return db;
};

// Set the default connection to vimusic.db (guest mode)
let dbConnection = getDatabaseConnection(); // This is global

// Function to download and save the user-specific database file to server's "public/database" folder
const downloadDatabaseToServer = async (userEmail) => {
  ensureDatabaseDirExists(); // Ensure directory exists

  const filePath = `databases/${userEmail}.db`;
  const destinationPath = path.join(__dirname, 'public', 'database', `${userEmail}.db`);

  try {
    // Firebase Admin method to download the file to the specified path
    await bucket.file(filePath).download({ destination: destinationPath });

    console.log(`Database file saved to ${destinationPath}`);

    // Now switch to the user-specific database
    dbConnection = getDatabaseConnection(userEmail);
    console.log(`Switched to user-specific database for ${userEmail}`);

  } catch (error) {
    console.error('Error downloading and saving database:', error);
  }
};

// ROUTES BEGIN ========================================================================================================

// Route to trigger the database download for a user
server.get('/download-database/:email', async (req, res) => {
  const userEmail = req.params.email;
  
  // Call the function to download and save the database file
  await downloadDatabaseToServer(userEmail);
  
  res.send('Database download initiated.');
});

// Route to delete the user's database file after sign-out
server.post('/logout/:email', async (req, res) => {
  const userEmail = req.params.email;
  const filePath = path.join(__dirname, 'public', 'database', `${userEmail}.db`);

  try {
    // Close the user-specific database connection first
    if (dbConnection) {
      dbConnection.close((err) => {
        if (err) {
          console.error('Error closing database connection:', err);
          return res.status(500).send('Error closing database connection.');
        }

        console.log('Database connection closed successfully.');

        // Add a small delay to ensure the file is released properly
        setTimeout(() => {
          // Now attempt to delete the database file
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath); // Delete the file
              console.log(`Database file ${filePath} deleted.`);
            } catch (unlinkError) {
              console.error('Error deleting database file:', unlinkError);
              return res.status(500).send('Error deleting database file.');
            }
          } else {
            console.log(`Database file ${filePath} not found.`);
          }

          // Reset the connection to the default guest database
          dbConnection = getDatabaseConnection();
          console.log('Switched back to the default guest database.');

          res.send('User signed out and database deleted.');
        }, 500); // Delay of 500ms to ensure file is released
      });
    } else {
      res.status(500).send('No database connection found.');
    }
  } catch (error) {
    console.error('Error during logout process:', error);
    res.status(500).send('Error during logout process.');
  }
});


// Fetch songs
server.get('/api/songs', (req, res) => {
  const sql = "SELECT * FROM song ORDER BY totalPlayTimeMs DESC LIMIT 100";

  dbConnection.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ songs: rows });
  });
});

// Fetch all playlists
server.get('/api/playlists', (req, res) => {
  const sql = 'SELECT * FROM Playlist';

  dbConnection.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ playlists: rows });
  });
});

// Fetch songs for a specific playlist
server.get('/api/playlists/:playlistId/songs', (req, res) => {
  const { playlistId } = req.params;

  const sql = `
    SELECT s.*
    FROM Song s
    INNER JOIN SongPlaylistMap spm ON s.id = spm.songId
    WHERE spm.playlistId = ?
    ORDER BY spm.position ASC
  `;

  dbConnection.all(sql, [playlistId], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ songs: rows });
  });
});

// Fetch favorite songs
server.get('/api/favorites', (req, res) => {
  const sql = `
    SELECT * FROM Song
    WHERE likedAt IS NOT NULL
    ORDER BY likedAt DESC
  `;

  dbConnection.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ songs: rows });
  });
});

// Serve static files (for your frontend)
server.use(express.static(path.join(__dirname, 'public')));

// Start the server
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
