import bcrypt from 'bcrypt';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { listKeysByScan } from '../redis.js';
import { query, pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getFloor, listOrgPresence, listPresence, pickBestFocus, resolvePresenceStatus } from '../services/presence.js';
import {
  clampGpsIntervalSec,
  clampGpsMaxAccuracyM,
  getOrgGpsSettings,
  normalizeGpsSettings,
} from '../services/orgGpsSettings.js';
import { logActivity } from '../services/activity.js';
import { isAdmin, isDispatch, isRoot, isZoneAdmin, isUnitAdmin, canManageUsers, ORG_ROLES, defaultVisibilityFlags } from '../services/roles.js';
import { buildUsername, buildCallSign, buildDisplayName } from '../services/rfcUsername.js';
import { generateTemporaryPassword } from '../services/tempPassword.js';
import { invalidateUserProfile } from '../services/userProfile.js';
import { clipOrgTreeToScope, fetchOrgUnitTree, fetchDependenciasTree, loadAdminScope, mapUnitBrief, createOrgRegion, createOrgZone, createOrgUnit, renameOrgUnit, deleteOrgUnitNode } from '../services/orgUnits.js';
import {
  mapAvatarUrl,
  removeOldAvatarFile,
  runAvatarUpload,
  sniffUploadedAvatar,
} from './me.js';
import { storedUploadRel } from '../services/uploads.js';
import { parseMatricula } from '../services/matricula.js';
import { unlockUserLogin, clientIpFromReq } from '../services/intrusion.js';
import fs from 'fs';

export const adminRouter = Router();
adminRouter.use(authMiddleware);

function requireDispatch(req, res, next) {
  if (!isDispatch(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root, admin, admin de zona o despachador' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root o admin' });
  }
  next();
}

/** Root / admin de org / admin de zona */
function requireUserManager(req, res, next) {
  if (!canManageUsers(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Sin permiso para administrar usuarios' });
  }
  next();
}

function requireRoot(req, res, next) {
  if (!isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo superadministrador (root)' });
  }
  next();
}

adminRouter.use(requireDispatch);

function mapUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.display_name,
    grade: u.grade || null,
    specialty: u.specialty || null,
    cargo: u.cargo || null,
    givenNames: u.given_names || null,
    paternalSurname: u.paternal_surname || null,
    maternalSurname: u.maternal_surname || null,
    matricula: u.matricula || null,
    fullName: [u.given_names, u.paternal_surname, u.maternal_surname]
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .join(' ') || u.display_name,
    role: u.role,
    isActive: u.is_active,
    canReceivePanic: u.can_receive_panic,
    mustChangePassword: Boolean(u.must_change_password),
    loginFailCount: u.login_fail_count != null ? Number(u.login_fail_count) : 0,
    loginLocked: Boolean(u.login_locked_at),
    loginLockedAt: u.login_locked_at || null,
    loginLockedReason: u.login_locked_reason || null,
    unitId: u.unit_id || null,
    adminScopeUnitId: u.admin_scope_unit_id || null,
    unitName: u.unit_name || null,
    zoneName: u.zone_name || null,
    canSeeRegion: Boolean(u.can_see_region),
    canSeeZones: Boolean(u.can_see_zones),
    canSeeUnits: Boolean(u.can_see_units),
    lastSeenAt: u.last_seen_at,
    location:
      u.latitude != null
        ? { latitude: u.latitude, longitude: u.longitude, recordedAt: u.location_at }
        : null,
  };
}

async function isUsernameTaken(orgId, username) {
  const { rows } = await query(
    `SELECT 1 FROM users WHERE organization_id = $1 AND LOWER(username) = LOWER($2) LIMIT 1`,
    [orgId, username]
  );
  return Boolean(rows[0]);
}

/** Dashboard: usuarios, grupos, online y speakers activos */
adminRouter.get('/overview', async (req, res) => {
  const orgId = req.user.orgId;

  const { rows: users } = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_active)::int AS active
     FROM users WHERE organization_id = $1`,
    [orgId]
  );

  const { rows: orgs } = await query(
    `SELECT presence_offline_red_minutes FROM organizations WHERE id = $1`,
    [orgId]
  );
  const offlineRedMinutes = Number(orgs[0]?.presence_offline_red_minutes) || 15;
  const offlineRedMs = offlineRedMinutes * 60_000;

  const { rows: groups } = await query(
    `SELECT id, name, livekit_room, is_active
     FROM groups WHERE organization_id = $1 AND is_active = TRUE
     ORDER BY name`,
    [orgId]
  );

  const channels = [];
  /** @type {Map<string, { userId: string, displayName: string, focus: string }>} */
  const presenceByUser = new Map();

  for (const g of groups) {
    const members = await listPresence(g.id);
    const floor = await getFloor(g.id);
    for (const m of members) {
      const prev = presenceByUser.get(m.userId);
      if (!prev) {
        presenceByUser.set(m.userId, { ...m });
      } else {
        presenceByUser.set(m.userId, {
          userId: m.userId,
          displayName: m.displayName || prev.displayName,
          focus: pickBestFocus([prev.focus, m.focus]),
        });
      }
    }
    channels.push({
      id: g.id,
      name: g.name,
      online: members,
      speaker: floor
        ? { userId: floor.userId, displayName: floor.displayName, since: floor.since }
        : null,
    });
  }

  // FGS / org-wide (p.ej. sin canal activo)
  try {
    const orgMembers = await listOrgPresence(orgId);
    for (const m of orgMembers) {
      const prev = presenceByUser.get(m.userId);
      if (!prev) {
        presenceByUser.set(m.userId, { ...m });
      } else {
        presenceByUser.set(m.userId, {
          userId: m.userId,
          displayName: m.displayName || prev.displayName,
          focus: pickBestFocus([prev.focus, m.focus]),
        });
      }
    }
  } catch {
    /* ignore */
  }

  const presence = {};
  for (const [userId, m] of presenceByUser) {
    presence[userId] = {
      userId,
      displayName: m.displayName,
      focus: m.focus,
      status: resolvePresenceStatus({ focus: m.focus, offlineRedMs }),
    };
  }

  res.json({
    ok: true,
    overview: {
      usersTotal: users[0]?.total || 0,
      usersActive: users[0]?.active || 0,
      onlineCount: presenceByUser.size,
      groupsCount: groups.length,
      channels,
      presence,
      presenceOfflineRedMinutes: offlineRedMinutes,
    },
  });
});

/** Preferencias de org: presencia + GPS. */
adminRouter.get('/org-settings', requireAdmin, async (req, res) => {
  const { rows } = await query(
    `SELECT presence_offline_red_minutes, gps_max_accuracy_m, gps_interval_sec
     FROM organizations WHERE id = $1`,
    [req.user.orgId]
  );
  const gps = normalizeGpsSettings(rows[0] || {});
  res.json({
    ok: true,
    settings: {
      presenceOfflineRedMinutes: Number(rows[0]?.presence_offline_red_minutes) || 15,
      gpsMaxAccuracyM: gps.maxAccuracyM,
      gpsIntervalSec: gps.intervalSec,
    },
  });
});

adminRouter.patch('/org-settings', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const updates = [];
  const params = [req.user.orgId];
  const meta = {};

  if (body.presenceOfflineRedMinutes != null) {
    const minutes = parseInt(body.presenceOfflineRedMinutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 10080) {
      return res.status(400).json({
        ok: false,
        error: 'presenceOfflineRedMinutes debe ser entre 1 y 10080 (minutos)',
      });
    }
    params.push(minutes);
    updates.push(`presence_offline_red_minutes = $${params.length}`);
    meta.presenceOfflineRedMinutes = minutes;
  }

  if (body.gpsMaxAccuracyM != null) {
    const acc = clampGpsMaxAccuracyM(body.gpsMaxAccuracyM);
    if (acc == null) {
      return res.status(400).json({
        ok: false,
        error: 'gpsMaxAccuracyM debe ser entre 10 y 200 (metros)',
      });
    }
    params.push(acc);
    updates.push(`gps_max_accuracy_m = $${params.length}`);
    meta.gpsMaxAccuracyM = acc;
  }

  if (body.gpsIntervalSec != null) {
    const sec = clampGpsIntervalSec(body.gpsIntervalSec);
    if (sec == null) {
      return res.status(400).json({
        ok: false,
        error: 'gpsIntervalSec debe ser entre 2 y 60 (segundos)',
      });
    }
    params.push(sec);
    updates.push(`gps_interval_sec = $${params.length}`);
    meta.gpsIntervalSec = sec;
  }

  if (!updates.length) {
    const gps = await getOrgGpsSettings(req.user.orgId);
    const { rows } = await query(
      `SELECT presence_offline_red_minutes FROM organizations WHERE id = $1`,
      [req.user.orgId]
    );
    return res.json({
      ok: true,
      settings: {
        presenceOfflineRedMinutes: Number(rows[0]?.presence_offline_red_minutes) || 15,
        gpsMaxAccuracyM: gps.maxAccuracyM,
        gpsIntervalSec: gps.intervalSec,
      },
    });
  }

  const { rows } = await query(
    `UPDATE organizations
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $1
     RETURNING presence_offline_red_minutes, gps_max_accuracy_m, gps_interval_sec`,
    params
  );
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'org.settings',
    entityType: 'organization',
    entityId: req.user.orgId,
    meta,
  });
  const gps = normalizeGpsSettings(rows[0] || {});
  res.json({
    ok: true,
    settings: {
      presenceOfflineRedMinutes: Number(rows[0]?.presence_offline_red_minutes) || 15,
      gpsMaxAccuracyM: gps.maxAccuracyM,
      gpsIntervalSec: gps.intervalSec,
    },
  });
});

adminRouter.get('/org-units', async (req, res) => {
  const full = await fetchOrgUnitTree(req.user.orgId);
  const scope = await loadAdminScope(req.user);
  const tree = clipOrgTreeToScope(full, scope);
  res.json({
    ok: true,
    tree,
    scope: {
      orgWide: scope.orgWide,
      level: scope.level || null,
      zoneId: scope.zoneId || null,
      unitIds: scope.unitIds || [],
    },
  });
});

/** Árbol Región → Zona → Unidad con flags en_uso (catálogo Dependencias). */
adminRouter.get('/dependencias', async (req, res) => {
  const tree = await fetchDependenciasTree(req.user.orgId);
  const scope = await loadAdminScope(req.user);
  res.json({
    ok: true,
    tree: clipOrgTreeToScope(tree, scope),
    canEdit: isAdmin(req.user.role),
  });
});

adminRouter.post('/dependencias/region', requireAdmin, async (req, res) => {
  try {
    const row = await createOrgRegion(req.user.orgId, req.body || {});
    res.status(201).json({ ok: true, unit: row });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

adminRouter.post('/dependencias/region/:regionId/zona', requireAdmin, async (req, res) => {
  try {
    const row = await createOrgZone(req.user.orgId, req.params.regionId, req.body || {});
    res.status(201).json({ ok: true, unit: row });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

adminRouter.post('/dependencias/zona/:zoneId/unidad', requireAdmin, async (req, res) => {
  try {
    const row = await createOrgUnit(req.user.orgId, req.params.zoneId, req.body || {});
    res.status(201).json({ ok: true, unit: row });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

adminRouter.patch('/dependencias/:id', requireAdmin, async (req, res) => {
  try {
    const row = await renameOrgUnit(req.user.orgId, req.params.id, req.body || {});
    res.json({ ok: true, unit: row });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

adminRouter.delete('/dependencias/:id', requireAdmin, async (req, res) => {
  try {
    await deleteOrgUnitNode(req.user.orgId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

adminRouter.get('/users', async (req, res) => {
  const scope = await loadAdminScope(req.user);
  const params = [req.user.orgId];
  let scopeSql = '';
  if (!scope.orgWide) {
    if (!scope.unitIds?.length) {
      return res.json({ ok: true, users: [] });
    }
    params.push(scope.unitIds);
    scopeSql = ` AND (u.unit_id = ANY($2::uuid[]) OR u.admin_scope_unit_id = ANY($2::uuid[]))`;
  }

  const { rows } = await query(
    `SELECT u.id, u.username, u.email, u.display_name, u.role, u.is_active, u.can_receive_panic,
            u.must_change_password, u.last_seen_at,
            u.login_fail_count, u.login_locked_at, u.login_locked_reason,
            u.grade, u.specialty, u.cargo, u.given_names, u.paternal_surname, u.maternal_surname, u.matricula,
            u.unit_id, u.admin_scope_unit_id,
            u.can_see_region, u.can_see_zones, u.can_see_units,
            ou.name AS unit_name,
            COALESCE(z.name, CASE WHEN ou.kind = 'zone' THEN ou.name END) AS zone_name,
            l.latitude, l.longitude, l.recorded_at AS location_at
     FROM users u
     LEFT JOIN user_last_location l ON l.user_id = u.id
     LEFT JOIN org_units ou ON ou.id = u.unit_id
     LEFT JOIN org_units z ON z.id = ou.parent_id AND z.kind = 'zone'
     WHERE u.organization_id = $1${scopeSql}
     ORDER BY
       CASE u.role
         WHEN 'root' THEN 0
         WHEN 'admin' THEN 1
         WHEN 'zone_admin' THEN 2
         WHEN 'unit_admin' THEN 3
         WHEN 'dispatcher' THEN 4
         ELSE 5
       END,
       u.display_name`,
    params
  );
  res.json({ ok: true, users: rows.map(mapUser) });
});

/** Vista previa: usuario login + indicativo (grado + apellido[, cargo]). */
adminRouter.post('/users/preview-username', requireUserManager, async (req, res) => {
  try {
    const body = req.body || {};
    const built = await buildUsername(
      {
        givenNames: body.givenNames,
        paternalSurname: body.paternalSurname,
        maternalSurname: body.maternalSurname,
        grade: body.grade,
        cargo: body.cargo,
        specialty: body.specialty,
      },
      (candidate) => isUsernameTaken(req.user.orgId, candidate)
    );
    res.json({
      ok: true,
      username: built.username,
      displayName: built.displayName,
      callSign: built.callSign,
      callSignShort: built.callSignShort,
      fullName: built.fullName,
      base: built.base,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Datos inválidos' });
  }
});

adminRouter.post('/users', requireUserManager, async (req, res) => {
  const {
    role = 'operator',
    givenNames,
    paternalSurname,
    maternalSurname,
    grade,
    specialty,
    cargo,
    matricula,
    unitId: unitIdIn,
    adminScopeUnitId: adminScopeIn,
    canSeeRegion: canSeeRegionIn,
    canSeeZones: canSeeZonesIn,
    canSeeUnits: canSeeUnitsIn,
  } = req.body || {};

  if (!ORG_ROLES.includes(role)) {
    return res.status(400).json({ ok: false, error: 'Rol inválido' });
  }
  if (role === 'root' && !isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root puede crear usuarios root' });
  }
  if ((role === 'admin' || role === 'root' || role === 'zone_admin') && (isZoneAdmin(req.user.role) || isUnitAdmin(req.user.role))) {
    return res.status(403).json({ ok: false, error: 'No puedes crear ese rol desde tu alcance' });
  }
  if (role === 'unit_admin' && isUnitAdmin(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'El admin de unidad no puede crear otros admin de unidad' });
  }

  const scope = await loadAdminScope(req.user);
  let unitId = unitIdIn ? String(unitIdIn).trim() : null;
  let adminScopeUnitId = adminScopeIn ? String(adminScopeIn).trim() : null;

  if (isZoneAdmin(req.user.role) || isUnitAdmin(req.user.role)) {
    if (isUnitAdmin(req.user.role)) {
      adminScopeUnitId = null;
      unitId = scope.unitId || scope.unitIds?.[0] || unitId;
    } else {
      adminScopeUnitId = null;
      if (unitId && scope.unitIds?.length && !scope.unitIds.includes(unitId)) {
        return res.status(403).json({ ok: false, error: 'Unidad fuera de tu zona' });
      }
      if (!unitId && scope.zoneId) unitId = scope.zoneId;
    }
  }

  if (role === 'zone_admin') {
    if (!adminScopeUnitId) {
      return res.status(400).json({ ok: false, error: 'Admin de zona requiere zona (adminScopeUnitId)' });
    }
    const { rows: z } = await query(
      `SELECT id FROM org_units
       WHERE id = $1 AND organization_id = $2 AND kind = 'zone' AND is_active`,
      [adminScopeUnitId, req.user.orgId]
    );
    if (!z[0]) {
      return res.status(400).json({ ok: false, error: 'Zona inválida para admin de zona' });
    }
  } else if (role === 'unit_admin') {
    const scopeUnit = adminScopeUnitId || unitId;
    if (!scopeUnit) {
      return res.status(400).json({ ok: false, error: 'Admin de unidad requiere unidad' });
    }
    const { rows: urow } = await query(
      `SELECT id FROM org_units
       WHERE id = $1 AND organization_id = $2 AND kind = 'unit' AND is_active`,
      [scopeUnit, req.user.orgId]
    );
    if (!urow[0]) {
      return res.status(400).json({ ok: false, error: 'Unidad inválida para admin de unidad' });
    }
    adminScopeUnitId = scopeUnit;
    unitId = unitId || scopeUnit;
  } else {
    adminScopeUnitId = null;
  }

  if (unitId) {
    const { rows: urow } = await query(
      `SELECT id FROM org_units WHERE id = $1 AND organization_id = $2 AND is_active`,
      [unitId, req.user.orgId]
    );
    if (!urow[0]) {
      return res.status(400).json({ ok: false, error: 'Unidad inválida' });
    }
  }

  const defaults = defaultVisibilityFlags(role);
  const canSeeRegion =
    typeof canSeeRegionIn === 'boolean' ? canSeeRegionIn : defaults.canSeeRegion;
  const canSeeZones =
    typeof canSeeZonesIn === 'boolean' ? canSeeZonesIn : defaults.canSeeZones;
  const canSeeUnits =
    typeof canSeeUnitsIn === 'boolean' ? canSeeUnitsIn : defaults.canSeeUnits;

  const gradeTrim = String(grade || '').trim();
  const specialtyTrim = String(specialty || '').trim() || null;
  const cargoTrim = String(cargo || '').trim() || null;
  let matriculaTrim;
  try {
    matriculaTrim = parseMatricula(matricula);
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Matrícula inválida' });
  }
  if (!gradeTrim) {
    return res.status(400).json({ ok: false, error: 'Grado es requerido' });
  }

  let built;
  try {
    built = await buildUsername(
      {
        givenNames,
        paternalSurname,
        maternalSurname,
        grade: gradeTrim,
        specialty: specialtyTrim,
        cargo: cargoTrim,
      },
      (candidate) => isUsernameTaken(req.user.orgId, candidate)
    );
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Datos de nombre inválidos' });
  }

  const username = built.username;
  const displayName = String(built.displayName || '').trim();
  if (!displayName) {
    return res.status(400).json({ ok: false, error: 'Indicativo requerido' });
  }
  const email = `${username}@tacticalptx.local`;
  const temporaryPassword = generateTemporaryPassword();
  const hash = await bcrypt.hash(temporaryPassword, 12);

  const rawGroupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds : [];
  const groupIds = [...new Set(rawGroupIds.map((id) => String(id || '').trim()).filter(Boolean))];

  try {
    const { rows } = await query(
      `INSERT INTO users (
         organization_id, username, email, password_hash, display_name, role, must_change_password,
         grade, specialty, cargo, given_names, paternal_surname, maternal_surname, matricula,
         unit_id, admin_scope_unit_id, can_see_region, can_see_zones, can_see_units
       )
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id, username, email, display_name, role, is_active, can_receive_panic,
                 must_change_password, last_seen_at,
                 grade, specialty, cargo, given_names, paternal_surname, maternal_surname, matricula,
                 unit_id, admin_scope_unit_id, can_see_region, can_see_zones, can_see_units`,
      [
        req.user.orgId,
        username,
        email,
        hash,
        displayName,
        role,
        gradeTrim,
        specialtyTrim,
        cargoTrim,
        String(givenNames || '').trim(),
        String(paternalSurname || '').trim(),
        String(maternalSurname || '').trim() || null,
        matriculaTrim,
        unitId,
        adminScopeUnitId,
        canSeeRegion,
        canSeeZones,
        canSeeUnits,
      ]
    );
    const u = rows[0];

    const memberRole =
      role === 'root' ||
      role === 'admin' ||
      role === 'zone_admin' ||
      role === 'unit_admin' ||
      role === 'dispatcher'
        ? 'leader'
        : 'member';
    const assignedGroups = [];
    for (const groupId of groupIds) {
      const { rows: g } = await query(
        `SELECT id, name, unit_id FROM groups
         WHERE id = $1 AND organization_id = $2 AND is_active = TRUE`,
        [groupId, req.user.orgId]
      );
      if (!g[0]) continue;
      if (
        !scope.orgWide &&
        g[0].unit_id &&
        scope.unitIds?.length &&
        !scope.unitIds.includes(g[0].unit_id)
      ) {
        continue;
      }
      await query(
        `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [groupId, u.id, memberRole]
      );
      assignedGroups.push({ id: g[0].id, name: g[0].name, role: memberRole });
    }

    // Auto-asignar canal de la unidad si no se eligió grupo
    if (!assignedGroups.length && unitId) {
      const { rows: ug } = await query(
        `SELECT id, name FROM groups
         WHERE organization_id = $1 AND unit_id = $2 AND is_active
         ORDER BY created_at LIMIT 1`,
        [req.user.orgId, unitId]
      );
      if (ug[0]) {
        await query(
          `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [ug[0].id, u.id, memberRole]
        );
        assignedGroups.push({ id: ug[0].id, name: ug[0].name, role: memberRole });
      }
    }

    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'user.create',
      entityType: 'user',
      entityId: u.id,
      meta: {
        username: u.username,
        role: u.role,
        groups: assignedGroups.map((g) => g.id),
        mustChangePassword: true,
        callSign: displayName,
        matricula: matriculaTrim,
      },
    });
    res.status(201).json({
      ok: true,
      user: mapUser(u),
      groups: assignedGroups,
      temporaryPassword,
    });
  } catch (err) {
    if (err.code === '23505') {
      const detail = String(err.detail || '');
      if (detail.includes('matricula') || detail.includes('idx_users_org_matricula')) {
        return res.status(409).json({ ok: false, error: 'Matrícula ya registrada' });
      }
      return res.status(409).json({ ok: false, error: 'Usuario ya existe' });
    }
    throw err;
  }
});

adminRouter.post('/users/:id/unlock-login', requireUserManager, async (req, res) => {
  const scope = await loadAdminScope(req.user);
  const { rows: existing } = await query(
    `SELECT id, role, unit_id, admin_scope_unit_id, username, login_locked_at
     FROM users WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!existing[0]) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  if (!scope.orgWide) {
    const inScope =
      (existing[0].unit_id && scope.unitIds.includes(existing[0].unit_id)) ||
      (existing[0].admin_scope_unit_id && scope.unitIds.includes(existing[0].admin_scope_unit_id));
    if (!inScope) {
      return res.status(403).json({ ok: false, error: 'Usuario fuera de tu alcance' });
    }
  }
  if (existing[0].role === 'root' && !isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root puede desbloquear un root' });
  }
  try {
    const out = await unlockUserLogin({
      userId: req.params.id,
      orgId: req.user.orgId,
      actorId: req.user.sub,
      sourceIp: clientIpFromReq(req),
    });
    res.json({ ok: true, ...out });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || 'No se pudo desbloquear' });
  }
});

adminRouter.patch('/users/:id', requireUserManager, async (req, res) => {
  const {
    isActive,
    role,
    canReceivePanic,
    password,
    resetPassword,
    unitId: unitIdIn,
    adminScopeUnitId: adminScopeIn,
    canSeeRegion: canSeeRegionIn,
    canSeeZones: canSeeZonesIn,
    canSeeUnits: canSeeUnitsIn,
    grade: gradeIn,
    specialty: specialtyIn,
    cargo: cargoIn,
    givenNames: givenNamesIn,
    paternalSurname: paternalSurnameIn,
    maternalSurname: maternalSurnameIn,
    matricula: matriculaIn,
  } = req.body || {};

  const { rows: existing } = await query(
    `SELECT id, role, unit_id, admin_scope_unit_id, grade, specialty, cargo,
            given_names, paternal_surname, maternal_surname, matricula, display_name
     FROM users
     WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!existing[0]) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

  const scope = await loadAdminScope(req.user);
  if (!scope.orgWide) {
    const inScope =
      (existing[0].unit_id && scope.unitIds.includes(existing[0].unit_id)) ||
      (existing[0].admin_scope_unit_id && scope.unitIds.includes(existing[0].admin_scope_unit_id));
    if (!inScope) {
      return res.status(403).json({ ok: false, error: 'Usuario fuera de tu alcance' });
    }
    if (role === 'root' || role === 'admin' || role === 'zone_admin') {
      return res.status(403).json({ ok: false, error: 'No puedes asignar ese rol' });
    }
  }

  if (existing[0].role === 'root' && !isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root puede modificar un root' });
  }
  if (role === 'root' && !isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root puede asignar rol root' });
  }
  if (role && !ORG_ROLES.includes(role)) {
    return res.status(400).json({ ok: false, error: 'Rol inválido' });
  }
  if (req.params.id === req.user.sub && typeof isActive === 'boolean' && !isActive) {
    return res.status(400).json({ ok: false, error: 'No puedes desactivarte a ti mismo' });
  }

  let unitId = unitIdIn === undefined ? undefined : unitIdIn ? String(unitIdIn).trim() : null;
  let adminScopeUnitId =
    adminScopeIn === undefined ? undefined : adminScopeIn ? String(adminScopeIn).trim() : null;

  if (!scope.orgWide && unitId && !scope.unitIds.includes(unitId)) {
    return res.status(403).json({ ok: false, error: 'Unidad fuera de tu alcance' });
  }

  const identityPatch =
    gradeIn !== undefined ||
    specialtyIn !== undefined ||
    cargoIn !== undefined ||
    givenNamesIn !== undefined ||
    paternalSurnameIn !== undefined ||
    maternalSurnameIn !== undefined ||
    matriculaIn !== undefined;

  let nextGrade = existing[0].grade;
  let nextSpecialty = existing[0].specialty;
  let nextCargo = existing[0].cargo;
  let nextGiven = existing[0].given_names;
  let nextPaternal = existing[0].paternal_surname;
  let nextMaternal = existing[0].maternal_surname;
  let nextMatricula = existing[0].matricula;
  let nextDisplayName = existing[0].display_name;

  if (identityPatch) {
    if (gradeIn !== undefined) nextGrade = String(gradeIn || '').trim() || null;
    if (specialtyIn !== undefined) nextSpecialty = String(specialtyIn || '').trim() || null;
    if (cargoIn !== undefined) nextCargo = String(cargoIn || '').trim() || null;
    if (givenNamesIn !== undefined) nextGiven = String(givenNamesIn || '').trim() || null;
    if (paternalSurnameIn !== undefined) nextPaternal = String(paternalSurnameIn || '').trim() || null;
    if (maternalSurnameIn !== undefined) {
      nextMaternal = String(maternalSurnameIn || '').trim() || null;
    }
    if (matriculaIn !== undefined) {
      try {
        nextMatricula = parseMatricula(matriculaIn);
      } catch (err) {
        return res.status(400).json({ ok: false, error: err.message || 'Matrícula inválida' });
      }
    }

    if (!nextGrade) {
      return res.status(400).json({ ok: false, error: 'Grado es requerido' });
    }
    if (!nextMatricula) {
      return res.status(400).json({ ok: false, error: 'Matrícula es requerida' });
    }
    if (!nextGiven || !nextPaternal) {
      return res.status(400).json({ ok: false, error: 'Nombre(s) y apellido paterno son requeridos' });
    }

    if (matriculaIn !== undefined) {
      const { rows: clash } = await query(
        `SELECT id FROM users
         WHERE organization_id = $1 AND LOWER(matricula) = LOWER($2) AND id <> $3
         LIMIT 1`,
        [req.user.orgId, nextMatricula, req.params.id]
      );
      if (clash[0]) {
        return res.status(409).json({ ok: false, error: 'Matrícula ya registrada' });
      }
    }

    try {
      nextDisplayName = buildCallSign({
        grade: nextGrade,
        paternalSurname: nextPaternal,
        cargo: nextCargo,
      });
      buildDisplayName({
        givenNames: nextGiven,
        paternalSurname: nextPaternal,
        maternalSurname: nextMaternal,
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message || 'Datos de identidad inválidos' });
    }
  }

  let temporaryPassword = null;
  let passwordHash = null;
  let forceChange = false;
  if (resetPassword === true) {
    temporaryPassword = generateTemporaryPassword();
    passwordHash = await bcrypt.hash(temporaryPassword, 12);
    forceChange = true;
  } else if (typeof password === 'string' && password.length > 0) {
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password mínimo 6 caracteres' });
    }
    passwordHash = await bcrypt.hash(password, 12);
    forceChange = true;
  }

  const { rows } = await query(
    `UPDATE users SET
       is_active = COALESCE($2, is_active),
       role = COALESCE($3, role),
       display_name = COALESCE($4, display_name),
       can_receive_panic = COALESCE($5, can_receive_panic),
       password_hash = COALESCE($6, password_hash),
       must_change_password = CASE WHEN $8::boolean THEN TRUE ELSE must_change_password END,
       unit_id = CASE WHEN $9::boolean THEN $10 ELSE unit_id END,
       admin_scope_unit_id = CASE WHEN $11::boolean THEN $12 ELSE admin_scope_unit_id END,
       can_see_region = COALESCE($13, can_see_region),
       can_see_zones = COALESCE($14, can_see_zones),
       can_see_units = COALESCE($15, can_see_units),
       grade = CASE WHEN $16::boolean THEN $17 ELSE grade END,
       specialty = CASE WHEN $16::boolean THEN $18 ELSE specialty END,
       cargo = CASE WHEN $16::boolean THEN $19 ELSE cargo END,
       given_names = CASE WHEN $16::boolean THEN $20 ELSE given_names END,
       paternal_surname = CASE WHEN $16::boolean THEN $21 ELSE paternal_surname END,
       maternal_surname = CASE WHEN $16::boolean THEN $22 ELSE maternal_surname END,
       matricula = CASE WHEN $16::boolean THEN $23 ELSE matricula END,
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $7
     RETURNING id, username, email, display_name, role, is_active, can_receive_panic,
               must_change_password, last_seen_at, unit_id, admin_scope_unit_id,
               can_see_region, can_see_zones, can_see_units,
               grade, specialty, cargo, given_names, paternal_surname, maternal_surname, matricula`,
    [
      req.params.id,
      typeof isActive === 'boolean' ? isActive : null,
      role || null,
      identityPatch ? nextDisplayName : null,
      typeof canReceivePanic === 'boolean' ? canReceivePanic : null,
      passwordHash,
      req.user.orgId,
      forceChange,
      unitId !== undefined,
      unitId ?? null,
      adminScopeUnitId !== undefined && canManageUsers(req.user.role),
      adminScopeUnitId ?? null,
      typeof canSeeRegionIn === 'boolean' ? canSeeRegionIn : null,
      typeof canSeeZonesIn === 'boolean' ? canSeeZonesIn : null,
      typeof canSeeUnitsIn === 'boolean' ? canSeeUnitsIn : null,
      identityPatch,
      nextGrade,
      nextSpecialty,
      nextCargo,
      nextGiven,
      nextPaternal,
      nextMaternal,
      nextMatricula,
    ]
  );
  const u = rows[0];
  invalidateUserProfile(u.id);
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: passwordHash ? 'user.reset_password' : 'user.update',
    entityType: 'user',
    entityId: u.id,
    meta: {
      isActive: u.is_active,
      role: u.role,
      displayName: u.display_name,
      canReceivePanic: u.can_receive_panic,
      passwordReset: Boolean(passwordHash),
      mustChangePassword: u.must_change_password,
      unitId: u.unit_id,
      identityUpdated: identityPatch,
    },
  });
  if (passwordHash) {
    await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [u.id]);
  }
  res.json({
    ok: true,
    user: mapUser(u),
    ...(temporaryPassword ? { temporaryPassword } : {}),
  });
});

/** Eliminar usuario. Root: cualquiera. Admin de zona: solo su alcance. */
adminRouter.delete('/users/:id', requireUserManager, async (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ ok: false, error: 'No puedes eliminarte a ti mismo' });
  }
  const { rows: existing } = await query(
    `SELECT id, role, username, unit_id, admin_scope_unit_id FROM users
     WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!existing[0]) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  if (existing[0].role === 'root' && !isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root puede eliminar un root' });
  }
  if (!isRoot(req.user.role) && !isZoneAdmin(req.user.role) && existing[0].role === 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo root puede eliminar admin' });
  }

  const scope = await loadAdminScope(req.user);
  if (!scope.orgWide) {
    const inScope =
      (existing[0].unit_id && scope.unitIds.includes(existing[0].unit_id)) ||
      (existing[0].admin_scope_unit_id && scope.unitIds.includes(existing[0].admin_scope_unit_id));
    if (!inScope) {
      return res.status(403).json({ ok: false, error: 'Usuario fuera de tu zona' });
    }
  } else if (!isRoot(req.user.role) && !isAdmin(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Sin permiso' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // DM: sender_id ON DELETE SET NULL rompería messages_target (exige sender en DM).
    await client.query(
      `DELETE FROM messages
       WHERE group_id IS NULL
         AND (sender_id = $1 OR recipient_id = $1)`,
      [req.params.id]
    );
    const { rows } = await client.query(
      `DELETE FROM users WHERE id = $1 AND organization_id = $2
       RETURNING id, username, email, role`,
      [req.params.id, req.user.orgId]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }
    await client.query('COMMIT');

    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'user.delete',
      entityType: 'user',
      entityId: rows[0].id,
      meta: { username: rows[0].username, role: rows[0].role },
    });
    res.json({ ok: true });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error('user.delete:', err.message);
    res.status(500).json({
      ok: false,
      error: 'No se pudo eliminar el usuario (hay datos vinculados). Intenta de nuevo o desactívalo.',
    });
  } finally {
    client.release();
  }
});

/** Exportación CSV de usuarios (alcance v1) */
adminRouter.get('/users.csv', async (req, res) => {
  const { rows } = await query(
    `SELECT username, matricula, grade, specialty, cargo, given_names, paternal_surname, maternal_surname,
            display_name, role, is_active, last_seen_at, created_at
     FROM users WHERE organization_id = $1
     ORDER BY display_name`,
    [req.user.orgId]
  );

  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    'username,matricula,grade,specialty,cargo,given_names,paternal_surname,maternal_surname,call_sign,role,is_active,last_seen_at,created_at',
  ];
  for (const u of rows) {
    lines.push(
      [
        esc(u.username),
        esc(u.matricula),
        esc(u.grade),
        esc(u.specialty),
        esc(u.cargo),
        esc(u.given_names),
        esc(u.paternal_surname),
        esc(u.maternal_surname),
        esc(u.display_name),
        esc(u.role),
        esc(u.is_active),
        esc(u.last_seen_at?.toISOString?.() || u.last_seen_at),
        esc(u.created_at?.toISOString?.() || u.created_at),
      ].join(',')
    );
  }

  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'user.export_csv',
    entityType: 'users',
    meta: { count: rows.length },
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tacticalptx-users.csv"');
  res.send(`\uFEFF${lines.join('\n')}\n`);
});

/** Historial / auditoría — solo root o admin de organización. */
adminRouter.get('/activity', requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 300);
  const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
  const action = String(req.query.action || '').trim();
  const q = String(req.query.q || '').trim();

  const params = [req.user.orgId];
  const filters = ['a.organization_id = $1'];

  if (action) {
    params.push(action);
    filters.push(`a.action = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    filters.push(
      `(u.display_name ILIKE $${i} OR u.email ILIKE $${i} OR u.username ILIKE $${i} OR a.action ILIKE $${i} OR COALESCE(a.entity_type, '') ILIKE $${i} OR COALESCE(a.meta::text, '') ILIKE $${i})`
    );
  }

  const where = filters.join(' AND ');
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;

  const { rows } = await query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.meta, a.created_at,
            u.email AS actor_email, u.display_name AS actor_name, u.username AS actor_username
     FROM activity_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT $${limIdx} OFFSET $${offIdx}`,
    params
  );

  const countParams = params.slice(0, params.length - 2);
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total
     FROM activity_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     WHERE ${where}`,
    countParams
  );

  const { rows: actionRows } = await query(
    `SELECT action, COUNT(*)::int AS count
     FROM activity_logs
     WHERE organization_id = $1
     GROUP BY action
     ORDER BY count DESC, action ASC
     LIMIT 40`,
    [req.user.orgId]
  );

  res.json({
    ok: true,
    total: countRows[0]?.total || 0,
    limit,
    offset,
    actions: actionRows.map((r) => ({ action: r.action, count: r.count })),
    activity: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      meta: r.meta,
      createdAt: r.created_at,
      actor: r.actor_email || r.actor_name || r.actor_username
        ? {
            email: r.actor_email || null,
            displayName: r.actor_name || null,
            username: r.actor_username || null,
          }
        : null,
    })),
  });
});

adminRouter.get('/groups', async (req, res) => {
  const { rows } = await query(
    `SELECT g.id, g.name, g.description, g.livekit_room, g.is_active, g.avatar_url,
            (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = g.id) AS member_count
     FROM groups g
     WHERE g.organization_id = $1
     ORDER BY g.name`,
    [req.user.orgId]
  );
  res.json({
    ok: true,
    groups: rows.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      livekit_room: g.livekit_room,
      is_active: g.is_active,
      member_count: g.member_count,
      avatar_url: g.avatar_url,
      avatarUrl: mapAvatarUrl(g.avatar_url),
    })),
  });
});

adminRouter.post('/groups/:id/avatar', requireAdmin, (req, res) => {
  runAvatarUpload(req, res, async (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'La foto supera el límite de 3 MB'
          : err.message || 'No se pudo subir la foto';
      return res.status(400).json({ ok: false, error: msg });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Imagen requerida (campo avatar)' });
    }
    try {
      if (!sniffUploadedAvatar(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
        return res.status(400).json({ ok: false, error: 'Formato no válido. Usa JPG, PNG o WebP' });
      }
      const { rows: prev } = await query(
        `SELECT id, avatar_url FROM groups WHERE id = $1 AND organization_id = $2`,
        [req.params.id, req.user.orgId]
      );
      if (!prev[0]) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
        return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
      }
      const old = prev[0].avatar_url;
      const stored = storedUploadRel(req) || req.file.filename;
      const { rows } = await query(
        `UPDATE groups SET avatar_url = $2, updated_at = NOW()
         WHERE id = $1 AND organization_id = $3
         RETURNING id, name, description, livekit_room, is_active, avatar_url`,
        [req.params.id, stored, req.user.orgId]
      );
      if (old && old !== stored) await removeOldAvatarFile(old);
      await logActivity({
        organizationId: req.user.orgId,
        actorId: req.user.sub,
        action: 'group.avatar',
        entityType: 'group',
        entityId: rows[0].id,
      });
      res.json({
        ok: true,
        group: {
          ...rows[0],
          avatarUrl: mapAvatarUrl(rows[0].avatar_url),
        },
        avatarUrl: mapAvatarUrl(rows[0].avatar_url),
      });
    } catch (e) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      console.error('group avatar:', e.message);
      res.status(500).json({ ok: false, error: 'No se pudo guardar el icono del grupo' });
    }
  });
});

adminRouter.delete('/groups/:id/avatar', requireAdmin, async (req, res) => {
  const { rows: prev } = await query(
    `SELECT id, avatar_url FROM groups WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!prev[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
  const old = prev[0].avatar_url;
  await query(
    `UPDATE groups SET avatar_url = NULL, updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  await removeOldAvatarFile(old);
  res.json({ ok: true, avatarUrl: null });
});

adminRouter.post('/groups', requireAdmin, async (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ ok: false, error: 'Nombre requerido' });
  }
  const roomId = `grp_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const { rows } = await query(
    `INSERT INTO groups (organization_id, name, description, livekit_room, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, description, livekit_room, is_active`,
    [req.user.orgId, name.trim(), description || null, roomId, req.user.sub]
  );
  await query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'leader')
     ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [rows[0].id, req.user.sub]
  );
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'group.create',
    entityType: 'group',
    entityId: rows[0].id,
    meta: { name: rows[0].name },
  });
  res.status(201).json({ ok: true, group: rows[0] });
});

adminRouter.patch('/groups/:id', requireAdmin, async (req, res) => {
  const { name, description, isActive } = req.body || {};
  const { rows } = await query(
    `UPDATE groups SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       is_active = COALESCE($4, is_active),
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $5
     RETURNING id, name, description, livekit_room, is_active`,
    [
      req.params.id,
      name?.trim() || null,
      description !== undefined ? description : null,
      typeof isActive === 'boolean' ? isActive : null,
      req.user.orgId,
    ]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'group.update',
    entityType: 'group',
    entityId: rows[0].id,
    meta: { name: rows[0].name, isActive: rows[0].is_active },
  });
  res.json({ ok: true, group: rows[0] });
});

/** Soft-delete (desactivar) o hard delete (root + ?hard=1) */
adminRouter.delete('/groups/:id', requireAdmin, async (req, res) => {
  const hard = String(req.query.hard || '') === '1' || req.body?.hard === true;
  if (hard && !isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Hard delete solo root' });
  }

  if (hard) {
    const { rows } = await query(
      `DELETE FROM groups WHERE id = $1 AND organization_id = $2
       RETURNING id, name`,
      [req.params.id, req.user.orgId]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'group.delete_hard',
      entityType: 'group',
      entityId: rows[0].id,
      meta: { name: rows[0].name },
    });
    return res.json({ ok: true, hard: true });
  }

  const { rows } = await query(
    `UPDATE groups SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING id, name`,
    [req.params.id, req.user.orgId]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'group.deactivate',
    entityType: 'group',
    entityId: rows[0].id,
    meta: { name: rows[0].name },
  });
  res.json({ ok: true, hard: false });
});

adminRouter.post('/groups/:id/members', async (req, res) => {
  const { userId, role = 'member' } = req.body || {};
  if (!userId) return res.status(400).json({ ok: false, error: 'userId requerido' });

  const { rows: g } = await query(
    `SELECT id FROM groups WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!g[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });

  await query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, userId, role]
  );
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'group.member_add',
    entityType: 'group',
    entityId: req.params.id,
    meta: { userId, role },
  });
  res.status(201).json({ ok: true });
});

adminRouter.delete('/groups/:id/members/:userId', requireAdmin, async (req, res) => {
  const { rows: g } = await query(
    `SELECT id FROM groups WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!g[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });

  const { rowCount } = await query(
    `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [req.params.id, req.params.userId]
  );
  if (!rowCount) return res.status(404).json({ ok: false, error: 'Miembro no encontrado' });
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'group.member_remove',
    entityType: 'group',
    entityId: req.params.id,
    meta: { userId: req.params.userId },
  });
  res.json({ ok: true });
});

adminRouter.get('/groups/:id/members', async (req, res) => {
  const { rows: g } = await query(
    `SELECT id FROM groups WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!g[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });

  const { rows } = await query(
    `SELECT u.id, u.display_name, u.username, u.email, u.role AS org_role, gm.role
     FROM group_members gm
     INNER JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY u.display_name`,
    [req.params.id]
  );
  res.json({
    ok: true,
    members: rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      username: r.username,
      email: r.email,
      orgRole: r.org_role,
      role: r.role,
    })),
  });
});

/** Vaciar chat del grupo (hard purge mensajes). Root o admin. */
adminRouter.post('/groups/:id/messages/purge', requireAdmin, async (req, res) => {
  const { rows: g } = await query(
    `SELECT id, name FROM groups WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!g[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });

  const { rowCount } = await query(`DELETE FROM messages WHERE group_id = $1`, [req.params.id]);
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'chat.purge',
    entityType: 'group',
    entityId: req.params.id,
    meta: { name: g[0].name, deleted: rowCount },
  });
  res.json({ ok: true, deleted: rowCount });
});

/** Escaneo liviano de claves presence (SCAN; sin KEYS). */
adminRouter.get('/presence', async (req, res) => {
  const keys = await listKeysByScan('presence:group:*', 500);
  const byGroup = {};
  for (const key of keys) {
    const groupId = key.replace('presence:group:', '');
    byGroup[groupId] = await listPresence(groupId);
  }
  res.json({ ok: true, presence: byGroup });
});
