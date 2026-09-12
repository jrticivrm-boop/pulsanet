import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { query, pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../../../database/migrations/025_tactical_sites.sql');

const sql = readFileSync(sqlPath, 'utf8');
await query(sql);
const { rows } = await query(
  `SELECT COUNT(*)::int AS n FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'tactical_sites'`
);
console.log('tactical_sites:', rows[0]?.n === 1 ? 'OK' : 'MISSING');
await pool.end();
