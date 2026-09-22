import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../../../database/migrations/020_private_call_logs.sql');

const sql = fs.readFileSync(sqlPath, 'utf8');
await pool.query(sql);
console.log('OK: 020_private_call_logs applied');
await pool.end();
