import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { query, pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../../../database/migrations/027_presence_org_settings.sql');

const sql = readFileSync(sqlPath, 'utf8');
await query(sql);
const { rows } = await query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'organizations'
     AND column_name = 'presence_offline_red_minutes'`
);
console.log('organizations.presence_offline_red_minutes:', rows[0] ? 'OK' : 'MISSING');
await pool.end();
