import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../../../database/migrations/023_message_deliveries.sql');
await query(readFileSync(sqlPath, 'utf8'));
const { rows } = await query(
  `SELECT to_regclass('public.message_deliveries') AS t`
);
console.log('023 message_deliveries:', rows[0]?.t || 'MISSING');
await pool.end();
