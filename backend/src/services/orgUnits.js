import { query } from '../db.js';
import { isAdmin, isRegionAdmin, isRoot, isUnitAdmin, isZoneAdmin, normalizeRole } from './roles.js';

/** IDs de un nodo + todos los descendientes en el árbol.
 *  Incluye zonas/unidades vinculadas vía org_unit_scope_links (anfitrión = root).
 */
export async function listScopeUnitIds(orgId, rootUnitId) {
  if (!rootUnitId) return [];
  const { rows } = await query(
    `WITH RECURSIVE roots AS (
       SELECT $1::uuid AS id
       UNION
       SELECT l.linked_id
       FROM org_unit_scope_links l
       WHERE l.host_zone_id = $1 AND l.organization_id = $2
     ),
     tree AS (
       SELECT u.id
       FROM org_units u
       INNER JOIN roots r ON r.id = u.id
       WHERE u.organization_id = $2
       UNION ALL
       SELECT u.id
       FROM org_units u
       INNER JOIN tree t ON u.parent_id = t.id
       WHERE u.organization_id = $2
     )
     SELECT DISTINCT id FROM tree`,
    [rootUnitId, orgId]
  );
  return rows.map((r) => r.id);
}

/**
 * Jerarquía operativa:
 * - Región (root/admin): maestro — oye y da seguimiento a todos.
 * - C.G. de Región: zona tipo `cg` con unidades subordinadas directas.
 * - Zonas (Z.M./apoyo): administran sus unidades — oyen y dan seguimiento.
 * - Unidades: administran sus servicios desplegados (usuarios con unit_id).
 */

/**
 * IDs de alcance para unit_admin: unidad asignada + subordinadas reales.
 * Si el alcance apunta por error a zona/región, NO se expande el árbol (evita
 * ver operadores de unidades hermanas).
 */
export async function listUnitAdminScopeIds(orgId, unitId) {
  if (!unitId) return [];
  const { rows } = await query(
    `SELECT id, kind FROM org_units WHERE id = $1 AND organization_id = $2 AND is_active`,
    [unitId, orgId]
  );
  const node = rows[0];
  if (!node) return [unitId];
  if (node.kind !== 'unit') {
    return [unitId];
  }
  const unitIds = await listScopeUnitIds(orgId, unitId);
  return unitIds.length ? unitIds : [unitId];
}

/**
 * Alcance para administrar usuarios.
 * - root/admin (Región): orgWide
 * - zone_admin (incl. C.G.): zona + unidades hijas
 * - unit_admin: solo su unidad asignada (+ subordinadas de ese nodo), no la zona padre
 */
export async function loadAdminScope(user) {
  if (!user?.sub) return { orgWide: false, unitIds: [] };
  if (isRoot(user.role)) {
    return { orgWide: true, unitIds: [], level: 'region' };
  }
  if (isRegionAdmin(user.role)) {
    const { rows: me } = await query(
      `SELECT admin_scope_unit_id FROM users WHERE id = $1`,
      [user.sub]
    );
    const regionId = me[0]?.admin_scope_unit_id;
    if (regionId) {
      const unitIds = await listScopeUnitIds(user.orgId, regionId);
      if (unitIds.length) {
        return { orgWide: false, unitIds, regionId, level: 'region' };
      }
    }
    return { orgWide: true, unitIds: [], level: 'region' };
  }

  const { rows } = await query(
    `SELECT unit_id, admin_scope_unit_id, role FROM users WHERE id = $1`,
    [user.sub]
  );
  const row = rows[0];
  if (!row) return { orgWide: false, unitIds: [] };

  if (isZoneAdmin(row.role)) {
    const scopeId = row.admin_scope_unit_id;
    if (!scopeId) return { orgWide: false, unitIds: [], level: 'zone' };
    const unitIds = await listScopeUnitIds(user.orgId, scopeId);
    return { orgWide: false, unitIds, zoneId: scopeId, level: 'zone' };
  }

  if (isUnitAdmin(row.role)) {
    const unitId = row.admin_scope_unit_id || row.unit_id;
    if (!unitId) return { orgWide: false, unitIds: [], level: 'unit' };
    const unitIds = await listUnitAdminScopeIds(user.orgId, unitId);
    return {
      orgWide: false,
      unitIds,
      unitId,
      level: 'unit',
    };
  }

  return { orgWide: false, unitIds: [] };
}

/**
 * Alcance de seguimiento (GPS) y oír en mapa: mismo criterio jerárquico + privilegios can_see_*.
 * - Ver Región / admin / dispatcher de mesa → toda la org
 * - Ver Zonas / zone_admin → unidades del árbol de zona (p. ej. C.G. o Z.M.)
 * - Ver Unidades / unit_admin → servicios desplegados de esa unidad (árbol)
 */
export async function loadTrackScope(user) {
  if (!user?.sub || !user?.orgId) return { orgWide: false, unitIds: [], level: null };

  const { rows } = await query(
    `SELECT role, unit_id, admin_scope_unit_id,
            can_see_region, can_see_zones, can_see_units
     FROM users WHERE id = $1`,
    [user.sub]
  );
  const me = rows[0];
  if (!me) return { orgWide: false, unitIds: [], level: null };

  // unit_admin: siempre su unidad (+ subordinadas reales), sin ampliar por chips R/Z ni zona padre.
  if (isUnitAdmin(me.role)) {
    const unitId = me.admin_scope_unit_id || me.unit_id;
    if (!unitId) return { orgWide: false, unitIds: [], level: 'unit' };
    const unitIds = await listUnitAdminScopeIds(user.orgId, unitId);
    return {
      orgWide: false,
      unitIds,
      unitId,
      level: 'unit',
    };
  }

  const role = normalizeRole(me.role);
  if (role === 'region_admin' || role === 'root') {
    if (role === 'region_admin' && me.admin_scope_unit_id) {
      const unitIds = await listScopeUnitIds(user.orgId, me.admin_scope_unit_id);
      if (unitIds.length) {
        return { orgWide: false, unitIds, regionId: me.admin_scope_unit_id, level: 'region' };
      }
    }
    return { orgWide: true, unitIds: [], level: 'region' };
  }
  if (role === 'region_user') {
    // Alcance 3: territorio = región de adscripción (unit_id), no orgWide ciego.
    const anchor = me.unit_id || me.admin_scope_unit_id;
    if (anchor) {
      const unitIds = await listScopeUnitIds(user.orgId, anchor);
      if (unitIds.length) {
        return { orgWide: false, unitIds, regionId: anchor, level: 'region' };
      }
    }
    return { orgWide: false, unitIds: [], level: 'region' };
  }
  if (role === 'unit_user') {
    const unitId = me.unit_id || me.admin_scope_unit_id;
    if (!unitId) return { orgWide: false, unitIds: [], level: 'unit' };
    return { orgWide: false, unitIds: [unitId], unitId, level: 'unit' };
  }
  if (role === 'zone_user') {
    const anchor = me.unit_id || me.admin_scope_unit_id;
    if (anchor) {
      const { rows: z } = await query(
        `WITH RECURSIVE up AS (
           SELECT id, parent_id, kind FROM org_units WHERE id = $1
           UNION ALL
           SELECT o.id, o.parent_id, o.kind
           FROM org_units o
           INNER JOIN up ON o.id = up.parent_id
         )
         SELECT id FROM up WHERE kind = 'zone' LIMIT 1`,
        [anchor]
      );
      if (z[0]?.id) {
        const unitIds = await listScopeUnitIds(user.orgId, z[0].id);
        return { orgWide: false, unitIds, zoneId: z[0].id, level: 'zone' };
      }
    }
  }

  const canRegion = Boolean(me.can_see_region) || isAdmin(me.role);
  if (canRegion) {
    return { orgWide: true, unitIds: [], level: 'region' };
  }

  const canZones = Boolean(me.can_see_zones) || isZoneAdmin(me.role);
  if (canZones) {
    const anchor =
      (isZoneAdmin(me.role) && me.admin_scope_unit_id) ||
      me.unit_id ||
      me.admin_scope_unit_id;
    let zoneRoot = null;
    if (anchor) {
      const { rows: z } = await query(
        `WITH RECURSIVE up AS (
           SELECT id, parent_id, kind FROM org_units WHERE id = $1
           UNION ALL
           SELECT o.id, o.parent_id, o.kind
           FROM org_units o
           INNER JOIN up ON o.id = up.parent_id
         )
         SELECT id FROM up WHERE kind = 'zone' LIMIT 1`,
        [anchor]
      );
      zoneRoot = z[0]?.id || null;
    }
    if (zoneRoot) {
      const unitIds = await listScopeUnitIds(user.orgId, zoneRoot);
      return { orgWide: false, unitIds, zoneId: zoneRoot, level: 'zone' };
    }
    // Chip Z sin zona resoluble: no vaciar el mapa; caer a alcance de unidad.
  }

  const canUnits = Boolean(me.can_see_units);
  if (canUnits) {
    const unitId = me.unit_id || me.admin_scope_unit_id;
    if (!unitId) return { orgWide: false, unitIds: [], level: 'unit' };
    return { orgWide: false, unitIds: [unitId], unitId, level: 'unit' };
  }

  return { orgWide: false, unitIds: [], level: null };
}

/** ¿El usuario objetivo (por unit_id) cae en el alcance de seguimiento? */
export function unitInTrackScope(scope, unitId) {
  if (!scope) return false;
  if (scope.orgWide) return true;
  if (!unitId) return false;
  return Array.isArray(scope.unitIds) && scope.unitIds.includes(unitId);
}

export async function getUserUnitId(userId) {
  const { rows } = await query(`SELECT unit_id FROM users WHERE id = $1`, [userId]);
  return rows[0]?.unit_id || null;
}

const GROUP_MEMBER_COUNT_SQL =
  `(SELECT COUNT(*)::int FROM group_members gmc WHERE gmc.group_id = g.id) AS member_count`;

/** Canales donde el usuario es miembro explícito (group_members). */
export async function listMemberGroups(user) {
  if (!user?.sub) return [];
  const { rows } = await query(
    `SELECT g.id, g.name, g.description, g.livekit_room, g.is_active, g.unit_id, g.avatar_url,
            gm.role AS member_role,
            ${GROUP_MEMBER_COUNT_SQL}
     FROM groups g
     INNER JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1 AND g.is_active = TRUE`,
    [user.sub]
  );
  return rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
}

/**
 * Canales visibles para radio/chat según privilegios + membresía.
 * Región → todos · Zonas → árbol de zona · Unidades → canal(es) de la unidad.
 */
export async function listVisibleGroups(user) {
  if (!user?.sub || !user?.orgId) return [];

  const { rows: meRows } = await query(
    `SELECT role, unit_id, admin_scope_unit_id,
            can_see_region, can_see_zones, can_see_units
     FROM users WHERE id = $1`,
    [user.sub]
  );
  const me = meRows[0];
  if (!me) return [];

  const memberGroups = await listMemberGroups(user);

  let privilegeGroups = [];

  // unit_admin: solo canales ligados a su unidad (no zona padre / hermanas).
  if (isUnitAdmin(me.role)) {
    const unitId = me.admin_scope_unit_id || me.unit_id;
    if (unitId) {
      const ids = await listUnitAdminScopeIds(user.orgId, unitId);
      const { rows } = await query(
        `SELECT g.id, g.name, g.description, g.livekit_room, g.is_active, g.unit_id, g.avatar_url,
                'leader'::text AS member_role,
                ${GROUP_MEMBER_COUNT_SQL}
         FROM groups g
         WHERE g.organization_id = $1 AND g.is_active = TRUE
           AND g.unit_id = ANY($2::uuid[])`,
        [user.orgId, ids]
      );
      privilegeGroups = rows;
    }
  } else {
  const canRegion = Boolean(me.can_see_region) || isAdmin(me.role);
  const canZones = Boolean(me.can_see_zones) || canRegion || isZoneAdmin(me.role);
  const canUnits = Boolean(me.can_see_units) || canZones;

  if (canRegion) {
    const { rows } = await query(
      `SELECT g.id, g.name, g.description, g.livekit_room, g.is_active, g.unit_id, g.avatar_url,
              'leader'::text AS member_role,
              ${GROUP_MEMBER_COUNT_SQL}
       FROM groups g
       WHERE g.organization_id = $1 AND g.is_active = TRUE`,
      [user.orgId]
    );
    privilegeGroups = rows;
  } else if (canZones) {
    // Ancla: zona del admin de zona, o unidad de adscripción → subir hasta kind=zone
    const anchor =
      (isZoneAdmin(me.role) && me.admin_scope_unit_id) ||
      me.unit_id ||
      me.admin_scope_unit_id;
    let zoneRoot = null;
    if (anchor) {
      const { rows: z } = await query(
        `WITH RECURSIVE up AS (
           SELECT id, parent_id, kind FROM org_units WHERE id = $1
           UNION ALL
           SELECT o.id, o.parent_id, o.kind
           FROM org_units o
           INNER JOIN up ON o.id = up.parent_id
         )
         SELECT id FROM up WHERE kind = 'zone' LIMIT 1`,
        [anchor]
      );
      zoneRoot = z[0]?.id || null;
    }
    const scopeIds = zoneRoot ? await listScopeUnitIds(user.orgId, zoneRoot) : [];
    if (scopeIds.length) {
      const { rows } = await query(
        `SELECT g.id, g.name, g.description, g.livekit_room, g.is_active, g.unit_id, g.avatar_url,
                'leader'::text AS member_role,
                ${GROUP_MEMBER_COUNT_SQL}
         FROM groups g
         WHERE g.organization_id = $1 AND g.is_active = TRUE
           AND g.unit_id = ANY($2::uuid[])`,
        [user.orgId, scopeIds]
      );
      privilegeGroups = rows;
    }
  } else if (canUnits) {
    const unitId = me.unit_id || me.admin_scope_unit_id;
    if (unitId) {
      const { rows } = await query(
        `SELECT g.id, g.name, g.description, g.livekit_room, g.is_active, g.unit_id, g.avatar_url,
                'leader'::text AS member_role,
                ${GROUP_MEMBER_COUNT_SQL}
         FROM groups g
         WHERE g.organization_id = $1 AND g.is_active = TRUE AND g.unit_id = $2`,
        [user.orgId, unitId]
      );
      privilegeGroups = rows;
    }
  }
  }

  const byId = new Map();
  for (const g of [...memberGroups, ...privilegeGroups]) {
    if (!byId.has(g.id)) byId.set(g.id, g);
  }
  return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
}

/** Recorta el árbol al alcance (zona/C.G. o una unidad). */
export function clipOrgTreeToScope(tree, scope) {
  if (!scope || scope.orgWide) return tree;
  const allowed = new Set(scope.unitIds || []);
  const zoneId = scope.zoneId;

  return (tree || [])
    .map((region) => {
      const zones = (region.children || [])
        .filter((z) => !zoneId || z.id === zoneId)
        .map((z) => {
          if (scope.level === 'zone' && zoneId && z.id === zoneId) {
            return z;
          }
          return {
            ...z,
            children: (z.children || []).filter((u) => allowed.has(u.id)),
          };
        })
        .filter((z) => (z.children || []).length > 0);
      return { ...region, children: zones };
    })
    .filter((r) => (r.children || []).length > 0);
}

/** Árbol Región → zonas → unidades para una org.
 *  Adjunta hijos virtuales por org_unit_scope_links (linked: true).
 */
export async function fetchOrgUnitTree(orgId) {
  const { rows } = await query(
    `SELECT id, parent_id, kind, zone_type, name, code, external_id, sort_order, is_active
     FROM org_units
     WHERE organization_id = $1 AND is_active
     ORDER BY sort_order, name`,
    [orgId]
  );

  const byId = new Map();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      parentId: r.parent_id,
      kind: r.kind,
      zoneType: r.zone_type,
      name: r.name,
      code: r.code,
      externalId: r.external_id,
      sortOrder: r.sort_order,
      children: [],
    });
  }
  const roots = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Vínculos: zona anfitriona muestra linked como organismo adicional
  try {
    const { rows: links } = await query(
      `SELECT host_zone_id, linked_id FROM org_unit_scope_links WHERE organization_id = $1`,
      [orgId]
    );
    for (const link of links) {
      const host = byId.get(link.host_zone_id);
      const linked = byId.get(link.linked_id);
      if (!host || !linked) continue;
      if (host.children.some((c) => c.id === linked.id)) continue;
      host.children.push({
        ...linked,
        // Copia superficial: no reutilizar el mismo array children del nodo real
        children: (linked.children || []).map((c) => ({ ...c, children: c.children || [] })),
        linked: true,
        linkedHostId: host.id,
      });
    }
  } catch (err) {
    // Tabla aún no migrada: el árbol sigue funcionando sin vínculos
    if (err?.code !== '42P01') throw err;
  }

  return roots;
}

export async function mapUnitBrief(unitId) {
  if (!unitId) return null;
  const { rows } = await query(
    `SELECT u.id, u.name, u.code, u.kind, u.zone_type,
            z.id AS zone_id, z.name AS zone_name, z.code AS zone_code
     FROM org_units u
     LEFT JOIN org_units z ON (
       (u.kind = 'unit' AND z.id = u.parent_id)
       OR (u.kind = 'zone' AND z.id = u.id)
     )
     WHERE u.id = $1`,
    [unitId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    kind: r.kind,
    zoneType: r.zone_type,
    zoneId: r.zone_id,
    zoneName: r.zone_name,
    zoneCode: r.zone_code,
  };
}

function slugCode(prefix, name) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28)
    .toUpperCase() || 'X';
  return `${prefix}_${base}_${Date.now().toString(36).slice(-4)}`.slice(0, 40);
}

/** Árbol con flags en_uso (usuarios/grupos/hijos) para el catálogo Dependencias. */
export async function fetchDependenciasTree(orgId) {
  const tree = await fetchOrgUnitTree(orgId);
  const { rows: useRows } = await query(
    `SELECT unit_id AS id, COUNT(*)::int AS n FROM users
     WHERE organization_id = $1 AND unit_id IS NOT NULL
     GROUP BY unit_id
     UNION ALL
     SELECT unit_id, COUNT(*)::int FROM groups
     WHERE organization_id = $1 AND unit_id IS NOT NULL
     GROUP BY unit_id`,
    [orgId]
  );
  const useCount = new Map();
  for (const r of useRows) {
    useCount.set(r.id, (useCount.get(r.id) || 0) + Number(r.n || 0));
  }

  function mark(node) {
    const children = (node.children || []).map(mark);
    const childUse = children.some((c) => c.inUse || (c.children || []).length);
    const selfUse = (useCount.get(node.id) || 0) > 0;
    return {
      ...node,
      children,
      inUse: selfUse || childUse,
      usageCount: useCount.get(node.id) || 0,
    };
  }
  return tree.map(mark);
}

export async function createOrgRegion(orgId, { name, code }) {
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre de región obligatorio'), { status: 400 });
  const c = String(code || '').trim() || slugCode('REG', nom);
  const { rows } = await query(
    `INSERT INTO org_units (organization_id, parent_id, kind, name, code, sort_order)
     VALUES ($1, NULL, 'region', $2, $3,
       COALESCE((SELECT MAX(sort_order)+10 FROM org_units WHERE organization_id=$1 AND kind='region'), 10))
     RETURNING id, name, code, kind`,
    [orgId, nom, c]
  );
  return rows[0];
}

export async function createOrgZone(orgId, regionId, { name, code, zoneType }) {
  const { rows: parent } = await query(
    `SELECT id FROM org_units WHERE id=$1 AND organization_id=$2 AND kind='region'`,
    [regionId, orgId]
  );
  if (!parent[0]) throw Object.assign(new Error('Región no encontrada'), { status: 404 });
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre de zona obligatorio'), { status: 400 });
  const zt = ['cg', 'zm', 'support'].includes(zoneType) ? zoneType : 'zm';
  const c = String(code || '').trim() || slugCode('ZON', nom);
  const { rows } = await query(
    `INSERT INTO org_units (organization_id, parent_id, kind, zone_type, name, code, sort_order)
     VALUES ($1, $2, 'zone', $3, $4, $5,
       COALESCE((SELECT MAX(sort_order)+10 FROM org_units WHERE parent_id=$2), 10))
     RETURNING id, name, code, kind, zone_type AS "zoneType"`,
    [orgId, regionId, zt, nom, c]
  );
  return rows[0];
}

export async function createOrgUnit(orgId, zoneId, { name, code }) {
  const { rows: parent } = await query(
    `SELECT id FROM org_units WHERE id=$1 AND organization_id=$2 AND kind='zone'`,
    [zoneId, orgId]
  );
  if (!parent[0]) throw Object.assign(new Error('Zona no encontrada'), { status: 404 });
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre de unidad/organismo obligatorio'), { status: 400 });
  const c = String(code || '').trim() || slugCode('UNI', nom);
  const { rows } = await query(
    `INSERT INTO org_units (organization_id, parent_id, kind, name, code, sort_order)
     VALUES ($1, $2, 'unit', $3, $4,
       COALESCE((SELECT MAX(sort_order)+10 FROM org_units WHERE parent_id=$2), 10))
     RETURNING id, name, code, kind`,
    [orgId, zoneId, nom, c]
  );
  // Canal PTT por unidad (mismo criterio que seed-units)
  const room = `grp_${c.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`.slice(0, 120);
  await query(
    `INSERT INTO groups (organization_id, name, description, livekit_room, unit_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (livekit_room) DO NOTHING`,
    [orgId, nom, `Canal PTT · ${nom}`, room, rows[0].id]
  );
  return rows[0];
}

export async function renameOrgUnit(orgId, id, { name, zoneType }) {
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre obligatorio'), { status: 400 });
  const { rows: cur } = await query(
    `SELECT id, kind FROM org_units WHERE id=$1 AND organization_id=$2`,
    [id, orgId]
  );
  if (!cur[0]) throw Object.assign(new Error('Dependencia no encontrada'), { status: 404 });
  let zt = null;
  if (cur[0].kind === 'zone' && zoneType && ['cg', 'zm', 'support'].includes(zoneType)) {
    zt = zoneType;
  }
  const { rows } = await query(
    `UPDATE org_units SET
       name = $3,
       zone_type = COALESCE($4, zone_type),
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING id, name, code, kind, zone_type AS "zoneType"`,
    [id, orgId, nom, zt]
  );
  if (cur[0].kind === 'unit') {
    await query(
      `UPDATE groups SET name = $2, description = $3, updated_at = NOW()
       WHERE organization_id = $1 AND unit_id = $4 AND is_active`,
      [orgId, nom, `Canal PTT · ${nom}`, id]
    );
  }
  return rows[0];
}

export async function deleteOrgUnitNode(orgId, id) {
  const { rows: cur } = await query(
    `SELECT id, kind FROM org_units WHERE id=$1 AND organization_id=$2`,
    [id, orgId]
  );
  if (!cur[0]) throw Object.assign(new Error('Dependencia no encontrada'), { status: 404 });

  const { rows: kids } = await query(
    `SELECT 1 FROM org_units WHERE parent_id=$1 AND is_active LIMIT 1`,
    [id]
  );
  if (kids[0]) {
    throw Object.assign(new Error('Tiene elementos hijos — no se puede eliminar'), { status: 409 });
  }

  const { rows: usedU } = await query(
    `SELECT 1 FROM users WHERE organization_id=$1 AND (unit_id=$2 OR admin_scope_unit_id=$2) LIMIT 1`,
    [orgId, id]
  );
  const { rows: usedG } = await query(
    `SELECT 1 FROM groups WHERE organization_id=$1 AND unit_id=$2 LIMIT 1`,
    [orgId, id]
  );
  if (usedU[0] || usedG[0]) {
    throw Object.assign(new Error('En uso — no se puede eliminar'), { status: 409 });
  }

  await query(`DELETE FROM org_units WHERE id=$1 AND organization_id=$2`, [id, orgId]);
}
