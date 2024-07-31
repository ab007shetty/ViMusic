const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../../database/vimusic.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

export default (req, res) => {
  const { playlistId } = req.query;
  const sql = `
    SELECT * FROM Song
    WHERE id IN (
      SELECT songId
      FROM SongPlaylistMap
      WHERE playlistId = ?
    )
  `;
  db.all(sql, [playlistId], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ songs: rows });
  });
};
