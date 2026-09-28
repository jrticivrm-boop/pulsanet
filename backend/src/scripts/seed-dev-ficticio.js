/**
 * Datos FICTICIOS para el ambiente de DESARROLLO (PC). Nunca para pruebas ni producción.
 *
 * Crea, en la primera zona con al menos 2 unidades:
 *   - Admin de región, admin de zona, admin de unidad, usuario de zona y 3 usuarios de unidad.
 *   - Canal de zona (todos) y canal de unidad (solo la unidad A).
 * Todos con la misma contraseña de desarrollo (generada al azar, se muestra al final).
 *
 * Uso (desde backend/):  node src/scripts/seed-dev-ficticio.js
 * Idempotente: si los usuarios ficticios ya existen no crea otros.
 */
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { buildUsername } from '../services/rfcUsername.js';
import { generateTemporaryPassword } from '../services/tempPassword.js';
import { defaultVisibilityFlags, defaultLocationShare, isUserProfile } from '../services/roles.js';
import { systemProfileIdByRole } from '../services/profiles.js';

const DEV_DB = 'tacticalptx_db';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const MARK = '(ficticio)';

function assertDevDatabase() {
  const raw = process.env.DATABASE_URL || '';
  let url;
  try {
    url = new URL(raw.replace(/^postgres(ql)?:/, 'http:'));
  } catch {
    throw new Error('DATABASE_URL inválida');
  }
  const db = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!LOCAL_HOSTS.has(url.hostname) || db !== DEV_DB) {
    throw new Error(
      `Solo se permite en la BD local de desarrollo (${DEV_DB} en localhost); actual: ${db}@${url.hostname}`
    );
  }
}

const PEOPLE = [
  { key: 'reg_admin', role: 'region_admin', grade: 'Cor.', givenNames: 'Ricardo', paternalSurname: 'Valdez', maternalSurname: 'Mora', cargo: 'Cmte. Región' },
  { key: 'zona_admin', role: 'zone_admin', grade: 'Tte. Cor.', givenNames: 'Sofia', paternalSurname: 'Castillo', maternalSurname: 'Rivas', cargo: 'Cmte. Zona' },
  { key: 'unidad_admin', role: 'unit_admin', grade: 'Myr.', givenNames: 'Hector', paternalSurname: 'Navarro', maternalSurname: 'Lara', cargo: 'Cmte. Unidad' },
  { key: 'zona_user', role: 'zone_user', grade: 'Cap. 1/o.', givenNames: 'Daniela', paternalSurname: 'Ochoa', maternalSurname: 'Pineda' },
  { key: 'u1', role: 'unit_user', grade: 'Tte.', givenNames: 'Mario', paternalSurname: 'Quintero', maternalSurname: 'Soto', unit: 'A' },
  { key: 'u2', role: 'unit_user', grade: 'Sgto. 1/o.', givenNames: 'Laura', paternalSurname: 'Beltran', maternalSurname: 'Vega', unit: 'A' },
  { key: 'u3', role: 'unit_user', grade: 'Cabo', givenNames: 'Jorge', paternalSurname: 'Arellano', maternalSurname: 'Nuñez', unit: 'B' },
];

async function pickStructure(orgId) {
  const { rows } = await query(
    `SELECT r.id AS region_id, r.name AS region_name,
            z.id AS zone_id, z.name AS zone_name,
            (ARRAY_AGG(u.id ORDER BY u.sort_order, u.name))[1:2] AS unit_ids,
            (ARRAY_AGG(u.name ORDER BY u.sort_order, u.name))[1:2] AS unit_names
     FROM org_units z
     JOIN org_units r ON r.id = z.parent_id AND r.kind = 'region' AND r.is_active
     JOIN org_units u ON u.parent_id = z.id AND u.kind = 'unit' AND u.is_active
     WHERE z.organization_id = $1 AND z.kind = 'zone' AND z.is_active
     GROUP BY r.id, r.name, r.sort_order, z.id, z.name, z.sort_order
     HAVING COUNT(u.id) >= 2
     ORDER BY r.sort_order, z.sort_order
     LIMIT 1`,
    [orgId]
  );
  if (!rows[0]) throw new Error('No hay una zona con al menos 2 unidades en la estructura');
  const s = rows[0];
  return {
    regionId: s.region_id,
    regionName: s.region_name,
    zoneId: s.zone_id,
    zoneName: s.zone_name,
    unitA: { id: s.unit_ids[0], name: s.unit_names[0] },
    unitB: { id: s.unit_ids[1], name: s.unit_names[1] },
  };
}

function placement(person, st) {
  switch (person.role) {
    case 'region_admin':
      return { unitId: null, adminScopeUnitId: st.regionId };
    case 'zone_admin':
      return { unitId: null, adminScopeUnitId: st.zoneId };
    case 'unit_admin':
      return { unitId: st.unitA.id, adminScopeUnitId: st.unitA.id };
    case 'zone_user':
      return { unitId: st.zoneId, adminScopeUnitId: null };
    default:
      return { unitId: person.unit === 'B' ? st.unitB.id : st.unitA.id, adminScopeUnitId: null };
  }
}

async function ensureGroup(orgId, rootId, { name, description, unitId, scopeLevel }) {
  const { rows: found } = await query(
    `SELECT id FROM groups WHERE organization_id = $1 AND name = $2 LIMIT 1`,
    [orgId, name]
  );
  if (found[0]) return found[0].id;
  const room = `grp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const { rows } = await query(
    `INSERT INTO groups (organization_id, name, description, livekit_room, created_by, unit_id, scope_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [orgId, name, description, room, rootId, unitId, scopeLevel]
  );
  return rows[0].id;
}

async function addMember(groupId, userId, role) {
  await query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [groupId, userId, role]
  );
}

async function main() {
  assertDevDatabase();

  const { rows: orgs } = await query(`SELECT id FROM organizations ORDER BY created_at LIMIT 1`);
  const orgId = orgs[0]?.id;
  if (!orgId) throw new Error('No hay organización (corre primero: npm run seed)');

  const { rows: roots } = await query(
    `SELECT id FROM users WHERE organization_id = $1 AND role = 'root' AND is_active ORDER BY created_at LIMIT 1`,
    [orgId]
  );
  const rootId = roots[0]?.id || null;

  const st = await pickStructure(orgId);
  const password = generateTemporaryPassword();
  const hash = await bcrypt.hash(password, 12);

  const users = {};
  let created = 0;
  for (const p of PEOPLE) {
    const { rows: existing } = await query(
      `SELECT id, username, display_name FROM users
       WHERE organization_id = $1 AND given_names = $2 AND paternal_surname = $3 AND maternal_surname = $4
       LIMIT 1`,
      [orgId, p.givenNames, p.paternalSurname, p.maternalSurname]
    );
    if (existing[0]) {
      users[p.key] = { ...existing[0], role: p.role, existed: true };
      continue;
    }

    const built = await buildUsername(p, async (candidate) => {
      const { rows } = await query(
        `SELECT 1 FROM users WHERE organization_id = $1 AND LOWER(username) = LOWER($2) LIMIT 1`,
        [orgId, candidate]
      );
      return Boolean(rows[0]);
    });
    const { unitId, adminScopeUnitId } = placement(p, st);
    const flags = defaultVisibilityFlags(p.role);
    const profileId = await systemProfileIdByRole(orgId, p.role);

    const { rows } = await query(
      `INSERT INTO users (
         organization_id, username, email, password_hash, display_name, role, must_change_password,
         grade, cargo, given_names, paternal_surname, maternal_surname,
         unit_id, admin_scope_unit_id, profile_id, can_see_region, can_see_zones, can_see_units,
         can_receive_panic, location_share
       )
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, TRUE, $18)
       RETURNING id, username, display_name`,
      [
        orgId,
        built.username,
        `${built.username}@tacticalptx.local`,
        hash,
        built.displayName,
        p.role,
        p.grade,
        p.cargo || null,
        p.givenNames,
        p.paternalSurname,
        p.maternalSurname,
        unitId,
        adminScopeUnitId,
        profileId,
        flags.canSeeRegion,
        flags.canSeeZones,
        flags.canSeeUnits,
        defaultLocationShare(p.role),
      ]
    );
    users[p.key] = { ...rows[0], role: p.role, existed: false };
    created += 1;
  }

  const zoneGroup = await ensureGroup(orgId, rootId, {
    name: `Canal ${st.zoneName} ${MARK}`,
    description: 'Canal de zona de desarrollo',
    unitId: st.zoneId,
    scopeLevel: 'zone',
  });
  const unitGroup = await ensureGroup(orgId, rootId, {
    name: `Canal ${st.unitA.name} ${MARK}`,
    description: 'Canal de unidad de desarrollo',
    unitId: st.unitA.id,
    scopeLevel: 'unit',
  });

  const memberRole = (role) => (isUserProfile(role) ? 'member' : 'leader');
  if (rootId) {
    await addMember(zoneGroup, rootId, 'leader');
    await addMember(unitGroup, rootId, 'leader');
  }
  for (const p of PEOPLE) {
    const u = users[p.key];
    await addMember(zoneGroup, u.id, memberRole(p.role));
    const inUnitA = ['reg_admin', 'zona_admin', 'unidad_admin', 'u1', 'u2'].includes(p.key);
    if (inUnitA) await addMember(unitGroup, u.id, memberRole(p.role));
  }

  console.log(`Estructura: ${st.regionName} / ${st.zoneName} / A=${st.unitA.name}, B=${st.unitB.name}`);
  console.log(`Canales: "Canal ${st.zoneName} ${MARK}", "Canal ${st.unitA.name} ${MARK}"`);
  console.log('');
  for (const p of PEOPLE) {
    const u = users[p.key];
    console.log(`${u.username.padEnd(20)} ${p.role.padEnd(13)} ${u.display_name}${u.existed ? '  (ya existía)' : ''}`);
  }
  console.log('');
  if (created > 0) {
    console.log(`Contraseña de desarrollo (usuarios nuevos): ${password}`);
  } else {
    console.log('No se crearon usuarios nuevos; conservan su contraseña anterior.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('seed-dev-ficticio falló:', err.message);
    process.exit(1);
  });
