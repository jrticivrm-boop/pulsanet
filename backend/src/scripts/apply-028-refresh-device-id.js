import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { query, pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../../../database/migrations/028_refresh_device_id.sql');

await query(readFileSync(sqlPath, 'utf8'));
const { rows } = await query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'refresh_tokens' AND column_name = 'device_id'`
);
console.log('refresh_tokens.device_id:', rows[0] ? 'OK' : 'MISSING');
await pool.end();
