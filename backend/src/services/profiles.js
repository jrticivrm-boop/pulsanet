import { query } from '../db.js';
import { isRoot, ORG_ROLES, ROLE_LABELS, normalizeRole } from './roles.js';
import { DEFAULT_SEE } from './visibility.js';

const SYSTEM_PROFILES = [
  {
    code: 'root',
    name: 'Administrador',
    locked: true,
    level: 'system',
    kind: 'admin',
    console: true,
    hide: false,
  },
  {
    code: 'region_admin',
    name: 'Administrador de región',
    locked: false,
    level: 'region',
    kind: 'admin',
    console: true,
    hide: true,
  },
  {
    code: 'region_user',
    name: 'Usuario de región',
    locked: false,
    level: 'region',
    kind: 'user',
    console: false,
    hide: false,
  },
  {
    code: 'zone_admin',
    name: 'Administrador de zona',
    locked: false,
    level: 'zone',
    kind: 'admin',
    console: true,
    hide: true,
  },
  {
    code: 'zone_user',
    name: 'Usuario de zona',
    locked: false,
    level: 'zone',
    kind: 'user',
    console: false,
    hide: false,
  },
  {
    code: 'unit_admin',
    name: 'Administrador de unidad',
    locked: false,
    level: 'unit',
    kind: 'admin',
    console: true,
    hide: true,
  },
  {
    code: 'unit_user',
    name: 'Usuario de unidad',
    locked: false,
    level: 'unit',
    kind: 'user',
    console: false,
    hide: false,
  },
];

const MODULES = [
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'grupos', label: 'Grupos / radio' },
  { key: 'mapa', label: 'Mapa' },
  { key: 'video', label: 'Video' },
  { key: 'panico', label: 'Alerta' },
  { key: 'avisos', label: 'Avisos' },
  { key: 'catalogos', label: 'Catálogos' },
  { key: 'configuracion', label: 'Configuración' },
];

function defaultModules(profile) {
  const full = profile.kind === 'admin' || profile.code === 'root';
  const mods = {};
  for (const m of MODULES) {
    mods[m.key] = {
      ver: true,
      agregar: full && m.key !== 'configuracion',
      editar: full,
      eliminar: profile.code === 'root' || (full && m.key !== 'configuracion'),
    };
  }
  if (!profile.console) {
    mods.usuarios = { ver: false, agregar: false, editar: false, eliminar: false };
    mods.catalogos = { ver: false, agregar: false, editar: false, eliminar: false };
    mods.configuracion = { ver: false, agregar: false, editar: false, eliminar: false };
  }
  mods.mapa.ver = true;
  mods.panico.ver = true;
  if (full) {
    mods.avisos = { ver: true, agregar: true, editar: false, eliminar: false };
  } else {
    mods.avisos = { ver: false, agregar: false, editar: false, eliminar: false };
  }
  return mods;
}

function seeMap(code) {
  const list = DEFAULT_SEE[code] || [];
  const obj = {};
  for (const role of ORG_ROLES) obj[role] = list.includes(role);
  return obj;
}

export function profileCatalog() {
  return { modules: MODULES, roles: ORG_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] })) };
}

export async function ensureProfileTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS access_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      code TEXT,
      name VARCHAR(120) NOT NULL,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      is_locked BOOLEAN NOT NULL DEFAULT FALSE,
      level TEXT NOT NULL DEFAULT 'unit',
      kind TEXT NOT NULL DEFAULT 'user',
      console_access BOOLEAN NOT NULL DEFAULT FALSE,
      can_hide_location BOOLEAN NOT NULL DEFAULT FALSE,
      modules JSONB NOT NULL DEFAULT '{}'::jsonb,
      visibility JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS access_profiles_org_code
    ON access_profiles (organization_id, code)
    WHERE code IS NOT NULL
  `);
}

export async function ensureSystemProfiles(orgId) {
  await ensureProfileTable();
  for (const p of SYSTEM_PROFILES) {
    const modules = defaultModules(p);
    const visibility = seeMap(p.code);
    await query(
      `INSERT INTO access_profiles (
         organization_id, code, name, is_system, is_locked, level, kind,
         console_access, can_hide_location, modules, visibility
       )
       VALUES ($1,$2,$3,TRUE,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
       ON CONFLICT (organization_id, code) WHERE code IS NOT NULL DO NOTHING`,
      [
        orgId,
        p.code,
        p.name,
        p.locked,
        p.level,
        p.kind,
        p.console,
        p.hide,
        JSON.stringify(modules),
        JSON.stringify(visibility),
      ]
    );
  }
}

export async function listProfiles(orgId) {
  await ensureSystemProfiles(orgId);
  const { rows } = await query(
    `SELECT id, code, name, is_system, is_locked, level, kind, console_access,
            can_hide_location, modules, visibility
     FROM access_profiles
     WHERE organization_id = $1
     ORDER BY is_system DESC, name`,
    [orgId]
  );
  return rows;
}

export async function createProfile(orgId, body) {
  await ensureSystemProfiles(orgId);
  const baseCode = normalizeRole(body.basedOn || 'unit_user');
  const { rows: baseRows } = await query(
    `SELECT * FROM access_profiles WHERE organization_id = $1 AND code = $2 LIMIT 1`,
    [orgId, baseCode === 'root' ? 'unit_user' : baseCode]
  );
  const base = baseRows[0];
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('Nombre de perfil requerido');
    err.status = 400;
    throw err;
  }
  const { rows } = await query(
    `INSERT INTO access_profiles (
       organization_id, code, name, is_system, is_locked, level, kind,
       console_access, can_hide_location, modules, visibility
     ) VALUES ($1, NULL, $2, FALSE, FALSE, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
     RETURNING id, code, name, is_system, is_locked, level, kind, console_access,
               can_hide_location, modules, visibility`,
    [
      orgId,
      name,
      body.level || base?.level || 'unit',
      body.kind || base?.kind || 'user',
      Boolean(body.consoleAccess ?? base?.console_access),
      Boolean(body.canHideLocation ?? base?.can_hide_location),
      JSON.stringify(body.modules || base?.modules || {}),
      JSON.stringify(body.visibility || base?.visibility || {}),
    ]
  );
  return rows[0];
}

export async function updateProfile(orgId, id, body) {
  const { rows: cur } = await query(
    `SELECT * FROM access_profiles WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  const row = cur[0];
  if (!row) {
    const err = new Error('Perfil no encontrado');
    err.status = 404;
    throw err;
  }
  if (row.is_locked || row.code === 'root') {
    const err = new Error('El perfil Administrador no se puede modificar');
    err.status = 403;
    throw err;
  }
  const { rows } = await query(
    `UPDATE access_profiles SET
       name = COALESCE($3, name),
       modules = COALESCE($4::jsonb, modules),
       visibility = COALESCE($5::jsonb, visibility),
       console_access = COALESCE($6, console_access),
       can_hide_location = COALESCE($7, can_hide_location),
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING id, code, name, is_system, is_locked, level, kind, console_access,
               can_hide_location, modules, visibility`,
    [
      id,
      orgId,
      body.name ? String(body.name).trim() : null,
      body.modules ? JSON.stringify(body.modules) : null,
      body.visibility ? JSON.stringify(body.visibility) : null,
      typeof body.consoleAccess === 'boolean' ? body.consoleAccess : null,
      typeof body.canHideLocation === 'boolean' ? body.canHideLocation : null,
    ]
  );
  return rows[0];
}

export async function deleteProfile(orgId, id) {
  const { rows } = await query(
    `SELECT is_system, is_locked, code FROM access_profiles WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  if (!rows[0]) {
    const err = new Error('Perfil no encontrado');
    err.status = 404;
    throw err;
  }
  if (rows[0].is_system || rows[0].is_locked) {
    const err = new Error('No se pueden eliminar los perfiles base del sistema');
    err.status = 403;
    throw err;
  }
  await query(`UPDATE users SET profile_id = NULL WHERE profile_id = $1`, [id]);
  await query(`DELETE FROM access_profiles WHERE id = $1 AND organization_id = $2`, [id, orgId]);
}

export function assertProfileManager(role) {
  if (!isRoot(role)) {
    const err = new Error('Solo el Administrador puede crear o editar perfiles');
    err.status = 403;
    throw err;
  }
}
