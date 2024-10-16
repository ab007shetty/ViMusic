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


// Add song to favorite
server.put('/api/songs/:songId/favorite', (req, res) => {
  const { songId } = req.params;

  // Check if the song already exists in the database
  const sqlCheck = 'SELECT * FROM Song WHERE id = ?';

  dbConnection.get(sqlCheck, [songId], (err, row) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (row) {
      // If the song exists, toggle favorite status
      if (row.likedAt === null) {
        // Add to favorites
        const sqlUpdateFavorite = 'UPDATE Song SET likedAt = ? WHERE id = ?';
        dbConnection.run(sqlUpdateFavorite, [Date.now(), songId], (updateErr) => {
          if (updateErr) {
            return res.status(400).json({ error: updateErr.message });
          }
          return res.json({ message: 'Added to favorites.', favorite: true });
        });
      } else {
        // Remove from favorites
        const sqlRemoveFavorite = 'UPDATE Song SET likedAt = NULL WHERE id = ?';
        dbConnection.run(sqlRemoveFavorite, [songId], (removeErr) => {
          if (removeErr) {
            return res.status(400).json({ error: removeErr.message });
          }
          return res.json({ message: 'Removed from favorites.', favorite: false });
        });
      }
    } else {
      // If the song doesn't exist, insert it first with the details from req.body
      const sqlInsert = `
        INSERT INTO Song (id, title, artistsText, durationText, thumbnailUrl, likedAt, totalPlayTimeMs) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`;

      // Destructure song details from the request body without default values
      const { 
        title, 
        artistsText, 
        durationText, 
        thumbnailUrl, 
        totalPlayTimeMs 
      } = req.body;

      // Insert the song into the database with its details, setting likedAt to the current time
      dbConnection.run(sqlInsert, [songId, title, artistsText, durationText, thumbnailUrl, Date.now(), totalPlayTimeMs], (insertErr) => {
        if (insertErr) {
          return res.status(400).json({ error: insertErr.message });
        }
        return res.json({ message: 'Song added to favorites and database.', favorite: true });
      });
    }
  });
});


/// Add song to a specific playlist
server.post('/api/playlists/:playlistId/songs/:songId', (req, res) => {
    const { playlistId, songId } = req.params;
    const { title, artistsText, durationText, thumbnailUrl, totalPlayTimeMs } = req.body;

    // Check if the song already exists in the database
    const sqlCheck = 'SELECT * FROM Song WHERE id = ?';
    dbConnection.get(sqlCheck, [songId], (err, row) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        // If the song doesn't exist, insert it first
        if (!row) {
            const sqlInsert = `
                INSERT INTO Song (id, title, artistsText, durationText, thumbnailUrl, likedAt, totalPlayTimeMs) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;

            dbConnection.run(sqlInsert, [songId, title, artistsText, durationText, thumbnailUrl, Date.now(), totalPlayTimeMs], (insertErr) => {
                if (insertErr) {
                    return res.status(400).json({ error: insertErr.message });
                }

                // After inserting the song, continue to add it to the playlist
                addToPlaylist(playlistId, songId, res);
            });
        } else {
            // If the song already exists, directly add it to the playlist
            addToPlaylist(playlistId, songId, res);
        }
    });
});

// Function to add song to playlist after checking its existence
function addToPlaylist(playlistId, songId, res) {
    // SQL query to fetch the current maximum position for the playlist
    const sql = 'SELECT MAX(position) AS maxPosition FROM SongPlaylistMap WHERE playlistId = ?';

    dbConnection.get(sql, [playlistId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch max position' });
        }

        // Determine the new position; if result is null or maxPosition is undefined, start from 0
        const maxPosition = result && result.maxPosition !== null ? result.maxPosition : 0;
        const newPosition = maxPosition + 1;

        // Insert into the SongPlaylistMap table
        const sqlInsertMap = 'INSERT INTO SongPlaylistMap (songId, playlistId, position) VALUES (?, ?, ?)';
        dbConnection.run(sqlInsertMap, [songId, playlistId, newPosition], (mapErr) => {
            if (mapErr) {
                return res.status(500).json({ error: 'Failed to add song to playlist' });
            }

            // Respond with success after the song has been added to the playlist
            return res.status(201).json({ message: 'Song added to playlist successfully', songId, playlistId, position: newPosition });
        });
    });
}



// Serve static files (for your frontend)
server.use(express.static(path.join(__dirname, 'public')));

// Start the server
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
