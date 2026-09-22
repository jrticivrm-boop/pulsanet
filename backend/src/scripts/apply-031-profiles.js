/**
 * Migración 031 — roles jerárquicos, perfiles y columnas de grupos/ubicación.
 * Cada sentencia va en su propia transacción (ADD VALUE de enum).
 */
import { query, pool } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function step(sql, params) {
  try {
    await query(sql, params);
    return 'ok';
  } catch (err) {
    if (err.code === '42710' || /already exists/i.test(err.message)) return 'exists';
    throw err;
  }
}

for (const value of ['region_admin', 'region_user', 'zone_user', 'unit_user']) {
  const r = await step(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS '${value}'`);
  console.log('enum', value, r);
}

await step(`ALTER TABLE users ADD COLUMN IF NOT EXISTS location_share TEXT NOT NULL DEFAULT 'peers'`);
await step(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_id UUID`);
await step(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS scope_level TEXT NOT NULL DEFAULT 'unit'`);
await step(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS membership_locked BOOLEAN NOT NULL DEFAULT FALSE`);

const migrated = await query(`
  UPDATE users SET role = 'region_admin'::user_role WHERE role = 'admin';
`);
console.log('admin→region_admin', migrated.rowCount);
const op = await query(`UPDATE users SET role = 'unit_user'::user_role WHERE role = 'operator'`);
console.log('operator→unit_user', op.rowCount);
const disp = await query(`UPDATE users SET role = 'region_user'::user_role WHERE role = 'dispatcher'`);
console.log('dispatcher→region_user', disp.rowCount);

await query(`
  UPDATE users SET location_share = CASE role::text
    WHEN 'region_admin' THEN 'region'
    WHEN 'zone_admin' THEN 'zone'
    WHEN 'unit_admin' THEN 'unit'
    ELSE 'peers'
  END
  WHERE location_share IS NULL OR location_share = 'peers' OR location_share = ''
`);

await query(`
  UPDATE users SET can_receive_panic = TRUE
  WHERE is_active = TRUE AND can_receive_panic = FALSE
`);

await query(`
  UPDATE groups SET scope_level = CASE
    WHEN unit_id IS NULL THEN 'region'
    ELSE 'unit'
  END
  WHERE scope_level IS NULL OR scope_level = ''
`);

const { rows } = await query(
  `SELECT role::text AS role, COUNT(*)::int AS n FROM users GROUP BY role ORDER BY role`
);
console.log('roles', rows);
await pool.end();
