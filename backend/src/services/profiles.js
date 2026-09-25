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

/**
 * Catálogo de módulos de consola (fuente de verdad para Perfiles + UI).
 * - ver: visible en menú / acceso al módulo
 * - tabs: pestañas internas (si el módulo las tiene)
 * - actions: CRUD aplicables (además de ver)
 * - group: agrupación visual en el editor de perfiles
 */
export const MODULES = [
  {
    key: 'mapa',
    label: 'Seguimiento',
    hint: 'Ubicación en vivo',
    group: 'operacion',
    groupLabel: 'Operación',
    actions: ['ver'],
    tabs: [],
  },
  {
    key: 'panico',
    label: 'Alerta',
    hint: 'Avisos de emergencia',
    group: 'operacion',
    groupLabel: 'Operación',
    actions: ['ver'],
    tabs: [],
  },
  {
    key: 'usuarios',
    label: 'Usuarios',
    hint: 'Altas y alcance',
    group: 'administracion',
    groupLabel: 'Administración',
    actions: ['ver', 'agregar', 'editar', 'eliminar'],
    tabs: [],
  },
  {
    key: 'avisos',
    label: 'Avisos',
    hint: 'Alertas globales',
    group: 'administracion',
    groupLabel: 'Administración',
    actions: ['ver', 'agregar', 'editar', 'eliminar'],
    tabs: [],
  },
  {
    key: 'grupos',
    label: 'Grupos',
    hint: 'Canales y radio',
    group: 'administracion',
    groupLabel: 'Administración',
    actions: ['ver', 'agregar', 'editar', 'eliminar'],
    tabs: [],
  },
  {
    key: 'catalogos',
    label: 'Catálogos',
    hint: 'Jerarquías, grados y más',
    group: 'sistema',
    groupLabel: 'Sistema',
    actions: ['ver', 'agregar', 'editar', 'eliminar'],
    tabs: [
      { key: 'jerarquias', label: 'Jerarquías' },
      { key: 'grados', label: 'Grados' },
      { key: 'empleos', label: 'Empleos' },
      { key: 'dependencias', label: 'Dependencias' },
    ],
  },
  {
    key: 'configuracion',
    label: 'Configuración',
    hint: 'Canales, estados y sistema',
    group: 'sistema',
    groupLabel: 'Sistema',
    actions: ['ver', 'editar'],
    tabs: [
      { key: 'canales', label: 'Canales' },
      { key: 'estados', label: 'Estados' },
      { key: 'respaldos', label: 'Respaldos' },
      { key: 'presencia', label: 'Presencia' },
      { key: 'eventos', label: 'Eventos' },
      { key: 'auditoria', label: 'Historial / Auditoría' },
    ],
  },
];

/** RESERVADO no es editable en perfiles: solo rol Administrador (root). */
export const RESERVED_MODULE_KEY = 'video';

const MODULE_BY_KEY = Object.fromEntries(MODULES.map((m) => [m.key, m]));

export function getModuleDef(key) {
  return MODULE_BY_KEY[key] || null;
}

function emptyActions(m, enabled) {
  const out = { ver: Boolean(enabled) };
  for (const act of m.actions || []) {
    if (act === 'ver') continue;
    out[act] = Boolean(enabled);
  }
  return out;
}

function defaultTabs(m, enabled) {
  if (!m.tabs?.length) return undefined;
  const tabs = {};
  for (const t of m.tabs) tabs[t.key] = Boolean(enabled);
  return tabs;
}

/**
 * Normaliza JSON de módulos (perfiles viejos sin `tabs`, keys huérfanas, etc.).
 */
export function normalizeModules(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const m of MODULES) {
    const cur = src[m.key] && typeof src[m.key] === 'object' ? src[m.key] : {};
    const ver = Boolean(cur.ver);
    const entry = { ver };
    for (const act of m.actions || []) {
      if (act === 'ver') continue;
      entry[act] = ver ? Boolean(cur[act]) : false;
    }
    if (m.tabs?.length) {
      const prevTabs = cur.tabs && typeof cur.tabs === 'object' ? cur.tabs : null;
      const tabs = {};
      for (const t of m.tabs) {
        if (!ver) {
          tabs[t.key] = false;
        } else if (prevTabs && Object.prototype.hasOwnProperty.call(prevTabs, t.key)) {
          tabs[t.key] = Boolean(prevTabs[t.key]);
        } else {
          // Perfiles antiguos sin tabs: si el módulo es visible, todas las pestañas on
          tabs[t.key] = true;
        }
      }
      // Si ver y ninguna pestaña: abrir la primera (evita módulo vacío)
      if (ver && !Object.values(tabs).some(Boolean)) {
        tabs[m.tabs[0].key] = true;
      }
      entry.tabs = tabs;
    }
    out[m.key] = entry;
  }
  return out;
}

function defaultModules(profile) {
  const full = profile.kind === 'admin' || profile.code === 'root';
  const isRoot = profile.code === 'root';
  const mods = {};

  for (const m of MODULES) {
    let ver = Boolean(profile.console) || ['mapa', 'panico', 'grupos'].includes(m.key);
    if (m.key === 'mapa' || m.key === 'panico') ver = true;
    if (m.key === 'avisos') ver = Boolean(full);
    if (!profile.console && ['usuarios', 'catalogos', 'configuracion'].includes(m.key)) {
      ver = false;
    }
    if (profile.console && ['usuarios', 'catalogos', 'configuracion', 'grupos'].includes(m.key)) {
      ver = true;
    }

    const entry = emptyActions(m, ver);
    if (ver) {
      for (const act of m.actions || []) {
        if (act === 'ver') continue;
        if (act === 'agregar') entry.agregar = full && m.key !== 'configuracion';
        else if (act === 'editar') entry.editar = full;
        else if (act === 'eliminar') {
          entry.eliminar = isRoot || (full && m.key !== 'configuracion');
        }
      }
      if (m.key === 'avisos' && full) {
        entry.agregar = true;
        entry.editar = false;
        entry.eliminar = false;
      }
    }
    const tabs = defaultTabs(m, ver);
    if (tabs) entry.tabs = tabs;
    mods[m.key] = entry;
  }

  return normalizeModules(mods);
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

/**
 * Rol ACL (`users.role`) derivado del perfil de acceso.
 * Sistema: `code`. Personalizado: level + kind (sin code).
 */
export function roleFromProfile(profile) {
  if (!profile) return 'unit_user';
  if (profile.code) return normalizeRole(profile.code);
  const level = String(profile.level || 'unit');
  const kind = String(profile.kind || 'user');
  if (level === 'system') return 'root';
  if (kind === 'admin') {
    if (level === 'region') return 'region_admin';
    if (level === 'zone') return 'zone_admin';
    return 'unit_admin';
  }
  if (level === 'region') return 'region_user';
  if (level === 'zone') return 'zone_user';
  return 'unit_user';
}

/** Carga un perfil de la org o lanza 404. */
export async function getProfileById(orgId, profileId) {
  if (!profileId) return null;
  await ensureSystemProfiles(orgId);
  const { rows } = await query(
    `SELECT id, code, name, is_system, is_locked, level, kind, console_access,
            can_hide_location, modules, visibility
     FROM access_profiles
     WHERE id = $1 AND organization_id = $2`,
    [String(profileId), orgId]
  );
  return rows[0] || null;
}

/** Perfil de sistema por código de rol (crea plantillas si faltan). */
export async function systemProfileIdByRole(orgId, role) {
  const code = normalizeRole(role);
  await ensureSystemProfiles(orgId);
  const { rows } = await query(
    `SELECT id FROM access_profiles
     WHERE organization_id = $1 AND code = $2
     LIMIT 1`,
    [orgId, code]
  );
  return rows[0]?.id || null;
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
       ON CONFLICT (organization_id, code) WHERE code IS NOT NULL DO UPDATE SET
         visibility = EXCLUDED.visibility,
         updated_at = NOW()
       WHERE access_profiles.is_system = TRUE`,
      [
        orgId,
        p.code,
        p.name,
        p.locked,
        p.level,
        p.kind,
        p.console,
        false, // Alcance 3: nadie oculta ubicación
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
  return rows.map((r) => ({ ...r, modules: normalizeModules(r.modules) }));
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
      JSON.stringify(normalizeModules(body.modules || base?.modules || {})),
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
  const modulesJson = body.modules
    ? JSON.stringify(normalizeModules(body.modules))
    : null;
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
      modulesJson,
      body.visibility ? JSON.stringify(body.visibility) : null,
      typeof body.consoleAccess === 'boolean' ? body.consoleAccess : null,
      typeof body.canHideLocation === 'boolean' ? body.canHideLocation : null,
    ]
  );
  const updated = rows[0];
  if (updated) updated.modules = normalizeModules(updated.modules);
  return updated;
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
