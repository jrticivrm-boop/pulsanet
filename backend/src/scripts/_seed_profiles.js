import { query, pool } from '../db.js';
import { ensureSystemProfiles } from '../services/profiles.js';

const { rows: orgs } = await query(`SELECT id FROM organizations`);
for (const org of orgs) {
  await ensureSystemProfiles(org.id);
  const linked = await query(
    `UPDATE users u
     SET profile_id = p.id
     FROM access_profiles p
     WHERE p.organization_id = u.organization_id
       AND p.code = u.role::text
       AND u.profile_id IS NULL`
  );
  console.log('org', org.id, 'linked', linked.rowCount);
}
const n = await query(`SELECT COUNT(*)::int AS n FROM access_profiles`);
console.log('profiles', n.rows[0].n);
await pool.end();
