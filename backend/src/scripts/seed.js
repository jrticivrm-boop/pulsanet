/**
 * Bootstrap mínimo (sin usuarios de prueba):
 * - Organización
 * - Un superadmin (root) solo si no existe ninguno
 * - Canal General
 *
 * Uso: npm run seed
 * Vars opcionales: BOOTSTRAP_GIVEN, BOOTSTRAP_PATERNAL, BOOTSTRAP_MATERNAL
 */
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { buildUsername } from '../services/rfcUsername.js';
import { generateTemporaryPassword } from '../services/tempPassword.js';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const BOOTSTRAP = {
  givenNames: process.env.BOOTSTRAP_GIVEN || 'Admin',
  paternalSurname: process.env.BOOTSTRAP_PATERNAL || 'TacticalPtx',
  maternalSurname: process.env.BOOTSTRAP_MATERNAL || 'Root',
  role: 'root',
};

async function ensureGeneralGroup(rootId) {
  let groupId;
  const { rows: grp } = await query(
    `INSERT INTO groups (organization_id, name, description, livekit_room, created_by)
     VALUES ($1, 'General', 'Canal principal', 'grp_general', $2)
     ON CONFLICT (livekit_room) DO NOTHING
     RETURNING id`,
    [ORG_ID, rootId]
  );
  groupId = grp[0]?.id;
  if (!groupId) {
    const existing = await query(
      `SELECT id FROM groups
       WHERE organization_id = $1 AND (livekit_room = 'grp_general' OR livekit_room = 'grp_demo_general')
       ORDER BY CASE WHEN livekit_room = 'grp_general' THEN 0 ELSE 1 END
       LIMIT 1`,
      [ORG_ID]
    );
    groupId = existing.rows[0]?.id;
    if (groupId) {
      await query(
        `UPDATE groups SET
           name = 'General',
           description = 'Canal principal',
           livekit_room = 'grp_general',
           is_active = TRUE,
           updated_at = NOW()
         WHERE id = $1`,
        [groupId]
      );
    }
  }
  if (groupId && rootId) {
    await query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'leader')
       ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'leader'`,
      [groupId, rootId]
    );
  }
  return groupId;
}

async function seed() {
  await query(
    `INSERT INTO organizations (id, name, slug)
     VALUES ($1, 'Organización', 'org')
     ON CONFLICT (id) DO UPDATE
       SET name = 'Organización', slug = 'org', updated_at = NOW()`,
    [ORG_ID]
  );

  const { rows: existingRoots } = await query(
    `SELECT id, username, display_name
     FROM users
     WHERE organization_id = $1 AND role = 'root' AND is_active = TRUE
     ORDER BY created_at
     LIMIT 5`,
    [ORG_ID]
  );

  let rootId = existingRoots[0]?.id || null;
  let createdCreds = null;

  if (existingRoots.length > 0) {
    console.log('Ya hay root activo(s); no se crea cuenta de prueba:');
    for (const r of existingRoots) {
      console.log(`  - ${r.username}  (${r.display_name})`);
    }
  } else {
    const built = await buildUsername(BOOTSTRAP, async (candidate) => {
      const { rows: taken } = await query(
        `SELECT 1 FROM users WHERE organization_id = $1 AND LOWER(username) = LOWER($2) LIMIT 1`,
        [ORG_ID, candidate]
      );
      return Boolean(taken[0]);
    });
    const { username, displayName } = built;
    const temporaryPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(temporaryPassword, 12);
    const email = `${username}@tacticalptx.local`;

    const { rows } = await query(
      `INSERT INTO users (
         organization_id, username, email, password_hash, display_name, role, must_change_password, is_active
       )
       VALUES ($1, $2, $3, $4, $5, 'root', TRUE, TRUE)
       ON CONFLICT (organization_id, username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             email = EXCLUDED.email,
             display_name = EXCLUDED.display_name,
             role = 'root',
             must_change_password = TRUE,
             is_active = TRUE,
             updated_at = NOW()
       RETURNING id, username`,
      [ORG_ID, username, email, hash, displayName]
    );
    rootId = rows[0].id;
    createdCreds = { username, displayName, temporaryPassword };
  }

  const groupId = await ensureGeneralGroup(rootId);

  console.log('Bootstrap OK (sin usuarios de prueba)');
  console.log(`  Organización: ${ORG_ID}`);
  if (createdCreds) {
    console.log(`  Root nuevo:   ${createdCreds.username}  (${createdCreds.displayName})`);
    console.log(`  Contraseña temporal: ${createdCreds.temporaryPassword}`);
    console.log('  Debe cambiarse en el primer ingreso.');
  }
  console.log(`  Grupo:        General (${groupId || 'n/d'})`);
}

seed().catch((err) => {
  console.error('Seed falló:', err.message);
  process.exit(1);
});
