
    import { createConnection } from 'sqlite3';
    import { join } from 'path';

    export default function handler(req, res) {
      const { playlistId } = req.query;
      const dbPath = join(process.cwd(), '../database/vimusic.db');
      const db = new createConnection(dbPath);

      const sql = \`
        SELECT * FROM Song
        WHERE id IN (
          SELECT songId
          FROM SongPlaylistMap
          WHERE playlistId = ?
        )
      \`;
      db.all(sql, [playlistId], (err, rows) => {
        if (err) {
          res.status(400).json({ error: err.message });
          return;
        }
        res.json({ songs: rows });
      });
    }
    