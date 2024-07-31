
    import { createConnection } from 'sqlite3';
    import { join } from 'path';

    export default function handler(req, res) {
      const dbPath = join(process.cwd(), '../database/vimusic.db');
      const db = new createConnection(dbPath);

      const sql = "SELECT * FROM song WHERE likedAt IS NOT NULL AND totalPlayTimeMs <> 0";
      db.all(sql, [], (err, rows) => {
        if (err) {
          res.status(400).json({ error: err.message });
          return;
        }
        res.json({ songs: rows });
      });
    }
    