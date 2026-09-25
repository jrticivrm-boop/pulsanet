import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { query } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../../../database/migrations/038_announcement_users_groups.sql');

const sql = fs.readFileSync(sqlPath, 'utf8');
await query(sql);
console.log('OK migration 038_announcement_users_groups');
process.exit(0);
