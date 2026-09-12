import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { query, pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../../../database/migrations/026_tactical_group_icons.sql');

const sql = readFileSync(sqlPath, 'utf8');
await query(sql);
const { rows } = await query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'tactical_site_groups' AND column_name = 'icon_url'`
);
console.log('tactical_site_groups.icon_url:', rows[0] ? 'OK' : 'MISSING');
const { rows: siteCol } = await query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'tactical_sites' AND column_name = 'icon_url'`
);
console.log('tactical_sites.icon_url dropped:', siteCol[0] ? 'STILL THERE' : 'OK');
await pool.end();
