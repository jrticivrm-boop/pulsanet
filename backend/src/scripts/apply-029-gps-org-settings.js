import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { query, pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../../../database/migrations/029_gps_org_settings.sql');

const sql = fs.readFileSync(sqlPath, 'utf8');
await query(sql);
const { rows } = await query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_name = 'organizations'
     AND column_name IN ('gps_max_accuracy_m', 'gps_interval_sec')
   ORDER BY column_name`
);
console.log(
  'gps columns:',
  rows.map((r) => r.column_name).join(', ') || 'MISSING'
);
await pool.end();
