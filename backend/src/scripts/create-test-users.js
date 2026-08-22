/**
 * Crea 5 usuarios de prueba (operadores) en General.
 * Uso: node src/scripts/create-test-users.js
 */
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { buildUsername } from '../services/rfcUsername.js';
import { generateTemporaryPassword } from '../services/tempPassword.js';

const PEOPLE = [
  {
    givenNames: 'Juan Carlos',
    paternalSurname: 'Ramirez',
    maternalSurname: 'Lopez',
    role: 'operator',
  },
  {
    givenNames: 'Maria',
    paternalSurname: 'Hernandez',
    maternalSurname: 'Garcia',
    role: 'operator',
  },
  {
    givenNames: 'Pedro',
    paternalSurname: 'Sanchez',
    maternalSurname: 'Torres',
    role: 'operator',
  },
  {
    givenNames: 'Ana',
    paternalSurname: 'Martinez',
    maternalSurname: 'Ruiz',
    role: 'dispatcher',
  },
  {
    givenNames: 'Luis',
    paternalSurname: 'Fernandez',
    maternalSurname: 'Diaz',
    role: 'operator',
  },
];

async function main() {
  const { rows: orgs } = await query(
    `SELECT id FROM organizations ORDER BY created_at LIMIT 1`
  );
  const orgId = orgs[0]?.id;
  if (!orgId) throw new Error('No hay organización');

  const { rows: groups } = await query(
    `SELECT id, name FROM groups
     WHERE organization_id = $1 AND is_active = TRUE
     ORDER BY CASE WHEN LOWER(name) = 'general' THEN 0 ELSE 1 END, name
     LIMIT 1`,
    [orgId]
  );
  const groupId = groups[0]?.id;

  const created = [];

  for (const person of PEOPLE) {
    const built = await buildUsername(person, async (candidate) => {
      const { rows } = await query(
        `SELECT 1 FROM users WHERE organization_id = $1 AND LOWER(username) = LOWER($2) LIMIT 1`,
        [orgId, candidate]
      );
      return Boolean(rows[0]);
    });

    const temporaryPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(temporaryPassword, 12);
    const email = `${built.username}@tacticalptx.local`;

    const { rows } = await query(
      `INSERT INTO users (
         organization_id, username, email, password_hash, display_name, role, must_change_password, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
       RETURNING id, username, display_name, role`,
      [orgId, built.username, email, hash, built.displayName, person.role]
    );
    const u = rows[0];

    if (groupId) {
      const memberRole = person.role === 'dispatcher' ? 'leader' : 'member';
      await query(
        `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [groupId, u.id, memberRole]
      );
    }

    created.push({
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      temporaryPassword,
    });
  }

  console.log('Usuarios de prueba creados (cambiar clave en el 1er ingreso):\n');
  for (const u of created) {
    console.log(
      `${u.username.padEnd(16)} ${u.temporaryPassword.padEnd(12)} ${u.displayName} (${u.role})`
    );
  }
  if (groupId) console.log(`\nGrupo: ${groups[0].name} (${groupId})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
