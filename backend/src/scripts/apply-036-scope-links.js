import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { query } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../../../database/migrations/036_org_unit_scope_links.sql');

const sql = fs.readFileSync(sqlPath, 'utf8');
await query(sql);
console.log('OK migration 036_org_unit_scope_links');

const hostName = '8/a. Z.M.';
const linkedNames = ['23/a. Coord. Unidad', '29/a. Coord. Unidad'];

const { rows: hosts } = await query(
  `SELECT id, name, organization_id FROM org_units
   WHERE kind = 'zone' AND is_active AND name = $1
   ORDER BY created_at DESC`,
  [hostName]
);
if (!hosts[0]) {
  console.error('No se encontró zona activa', hostName);
  process.exit(1);
}
const host = hosts[0];
console.log('Host:', host.name, host.id);

for (const name of linkedNames) {
  const { rows: linked } = await query(
    `SELECT id, name FROM org_units
     WHERE organization_id = $1 AND kind = 'zone' AND is_active AND name = $2
     LIMIT 1`,
    [host.organization_id, name]
  );
  if (!linked[0]) {
    console.warn('No encontrada:', name);
    continue;
  }
  await query(
    `INSERT INTO org_unit_scope_links (organization_id, host_zone_id, linked_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (host_zone_id, linked_id) DO NOTHING`,
    [host.organization_id, host.id, linked[0].id]
  );
  console.log('Vinculada →', linked[0].name, linked[0].id);
}

const { rows: check } = await query(
  `SELECT h.name AS host, l.name AS linked
   FROM org_unit_scope_links x
   JOIN org_units h ON h.id = x.host_zone_id
   JOIN org_units l ON l.id = x.linked_id
   WHERE x.host_zone_id = $1`,
  [host.id]
);
console.log('Vínculos:', check);
process.exit(0);
