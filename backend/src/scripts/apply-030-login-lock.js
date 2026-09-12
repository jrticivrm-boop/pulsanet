import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { query, pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../../../database/migrations/030_login_lock.sql');

const sql = fs.readFileSync(sqlPath, 'utf8');
await query(sql);
const { rows } = await query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_name = 'users'
     AND column_name IN ('login_fail_count', 'login_locked_at', 'login_locked_reason')
   ORDER BY column_name`
);
console.log(
  'login lock columns:',
  rows.map((r) => r.column_name).join(', ') || 'MISSING'
);
await pool.end();
