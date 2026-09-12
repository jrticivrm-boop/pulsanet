import { query } from '../db.js';

const DEFAULT_COLORS = ['#c4a35a', '#3ecf9a', '#5b8def', '#e07a5f', '#9b59b6', '#1abc9c', '#f39c12'];

function mapGroup(r) {
  return {
    id: r.id,
    name: r.name,
    color: r.color || '#c4a35a',
    sortOrder: r.sort_order,
    isActive: r.is_active !== false,
    siteCount: Number(r.site_count || 0),
    iconUrl: r.icon_url ? `/api/tactical-sites/groups/${r.id}/icon` : null,
    iconStored: r.icon_url || null,
    createdAt: r.created_at,
  };
}

function mapSite(r) {
  return {
    id: r.id,
    groupId: r.group_id,
    groupName: r.group_name || null,
    groupColor: r.group_color || '#c4a35a',
    groupIconUrl: r.group_icon_url
      ? `/api/tactical-sites/groups/${r.group_id}/icon`
      : null,
    name: r.name,
    locationText: r.location_text || null,
    notes: r.notes || null,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    radiusM: r.radius_m != null ? Number(r.radius_m) : null,
    sortOrder: r.sort_order,
    isActive: r.is_active !== false,
    createdAt: r.created_at,
  };
}

export async function ensureTacticalSitesTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS tactical_site_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      color VARCHAR(16) NOT NULL DEFAULT '#c4a35a',
      icon_url VARCHAR(500),
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (organization_id, name)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS tactical_sites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      group_id UUID NOT NULL REFERENCES tactical_site_groups(id) ON DELETE CASCADE,
      name VARCHAR(160) NOT NULL,
      location_text VARCHAR(400),
      notes TEXT,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      radius_m REAL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`ALTER TABLE tactical_sites ADD COLUMN IF NOT EXISTS location_text VARCHAR(400)`);
  await query(`ALTER TABLE tactical_site_groups ADD COLUMN IF NOT EXISTS icon_url VARCHAR(500)`);
}

export async function listTacticalSiteGroups(orgId) {
  await ensureTacticalSitesTables();
  const { rows } = await query(
    `SELECT g.id, g.name, g.color, g.icon_url, g.sort_order, g.is_active, g.created_at,
            COUNT(s.id) FILTER (WHERE s.is_active)::int AS site_count
     FROM tactical_site_groups g
     LEFT JOIN tactical_sites s ON s.group_id = g.id AND s.organization_id = g.organization_id
     WHERE g.organization_id = $1 AND g.is_active
     GROUP BY g.id
     ORDER BY g.sort_order, g.name`,
    [orgId]
  );
  return rows.map(mapGroup);
}

export async function createTacticalSiteGroup(orgId, { name, color }) {
  await ensureTacticalSitesTables();
  const nom = String(name || '').trim();
  if (!nom || nom.length > 120) {
    throw Object.assign(new Error('Nombre de grupo requerido (máx 120)'), { status: 400 });
  }
  const col = String(color || '').trim() || DEFAULT_COLORS[0];
  const { rows: soft } = await query(
    `SELECT id FROM tactical_site_groups
     WHERE organization_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND is_active = FALSE`,
    [orgId, nom]
  );
  if (soft[0]) {
    const { rows } = await query(
      `UPDATE tactical_site_groups
       SET is_active = TRUE, name = $3, color = $4, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, color, icon_url, sort_order, is_active, created_at`,
      [soft[0].id, orgId, nom, col]
    );
    return mapGroup({ ...rows[0], site_count: 0 });
  }
  const { rows } = await query(
    `INSERT INTO tactical_site_groups (organization_id, name, color, sort_order)
     VALUES ($1, $2, $3,
       COALESCE((SELECT MAX(sort_order) + 10 FROM tactical_site_groups WHERE organization_id = $1), 10))
     RETURNING id, name, color, icon_url, sort_order, is_active, created_at`,
    [orgId, nom, col]
  );
  return mapGroup({ ...rows[0], site_count: 0 });
}

export async function updateTacticalSiteGroup(orgId, id, { name, color }) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (typeof name === 'string' && name.trim()) {
    sets.push(`name = $${i++}`);
    vals.push(name.trim());
  }
  if (typeof color === 'string' && color.trim()) {
    sets.push(`color = $${i++}`);
    vals.push(color.trim());
  }
  if (!sets.length) {
    throw Object.assign(new Error('Nada que actualizar'), { status: 400 });
  }
  sets.push('updated_at = NOW()');
  vals.push(id, orgId);
  const { rows } = await query(
    `UPDATE tactical_site_groups SET ${sets.join(', ')}
     WHERE id = $${i++} AND organization_id = $${i} AND is_active
     RETURNING id, name, color, icon_url, sort_order, is_active, created_at`,
    vals
  );
  if (!rows[0]) throw Object.assign(new Error('Grupo no encontrado'), { status: 404 });
  return mapGroup({ ...rows[0], site_count: 0 });
}

export async function deleteTacticalSiteGroup(orgId, id) {
  const { rowCount } = await query(
    `UPDATE tactical_site_groups SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND is_active`,
    [id, orgId]
  );
  if (!rowCount) throw Object.assign(new Error('Grupo no encontrado'), { status: 404 });
  await query(
    `UPDATE tactical_sites SET is_active = FALSE, updated_at = NOW()
     WHERE group_id = $1 AND organization_id = $2`,
    [id, orgId]
  );
}

export async function listTacticalSites(orgId, { groupId } = {}) {
  await ensureTacticalSitesTables();
  const params = [orgId];
  let filter = 's.organization_id = $1 AND s.is_active AND g.is_active';
  if (groupId) {
    params.push(groupId);
    filter += ` AND s.group_id = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT s.id, s.group_id, s.name, s.location_text, s.notes, s.latitude, s.longitude, s.radius_m,
            s.sort_order, s.is_active, s.created_at,
            g.name AS group_name, g.color AS group_color, g.icon_url AS group_icon_url
     FROM tactical_sites s
     INNER JOIN tactical_site_groups g ON g.id = s.group_id
     WHERE ${filter}
     ORDER BY g.sort_order, g.name, s.sort_order, s.name`,
    params
  );
  return rows.map(mapSite);
}

function parseCoords(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw Object.assign(new Error('latitude y longitude numéricos'), { status: 400 });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw Object.assign(new Error('Coordenadas fuera de rango'), { status: 400 });
  }
  return { latitude, longitude };
}

export async function createTacticalSite(orgId, body = {}) {
  await ensureTacticalSitesTables();
  const groupId = body.groupId;
  const nom = String(body.name || '').trim();
  if (!groupId) throw Object.assign(new Error('groupId requerido'), { status: 400 });
  if (!nom || nom.length > 160) {
    throw Object.assign(new Error('Nombre de sitio requerido (máx 160)'), { status: 400 });
  }
  const { rows: g } = await query(
    `SELECT id, name, color, icon_url FROM tactical_site_groups
     WHERE id = $1 AND organization_id = $2 AND is_active`,
    [groupId, orgId]
  );
  if (!g[0]) throw Object.assign(new Error('Grupo no encontrado'), { status: 404 });
  const { latitude, longitude } = parseCoords(body.latitude, body.longitude);
  let radiusM = null;
  if (body.radiusM != null && body.radiusM !== '') {
    radiusM = Number(body.radiusM);
    if (!Number.isFinite(radiusM) || radiusM <= 0 || radiusM > 50000) {
      throw Object.assign(new Error('radiusM entre 1 y 50000'), { status: 400 });
    }
  }
  const notes = body.notes != null ? String(body.notes).trim() || null : null;
  const locationText =
    body.locationText != null ? String(body.locationText).trim() || null : null;
  if (locationText && locationText.length > 400) {
    throw Object.assign(new Error('Ubicación máx 400 caracteres'), { status: 400 });
  }
  const { rows } = await query(
    `INSERT INTO tactical_sites
       (organization_id, group_id, name, location_text, notes, latitude, longitude, radius_m, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
       COALESCE((SELECT MAX(sort_order) + 10 FROM tactical_sites WHERE group_id = $2), 10))
     RETURNING id, group_id, name, location_text, notes, latitude, longitude, radius_m, sort_order, is_active, created_at`,
    [orgId, groupId, nom, locationText, notes, latitude, longitude, radiusM]
  );
  return mapSite({
    ...rows[0],
    group_name: g[0].name,
    group_color: g[0].color,
    group_icon_url: g[0].icon_url,
  });
}

export async function updateTacticalSite(orgId, id, body = {}) {
  const { rows: cur } = await query(
    `SELECT id FROM tactical_sites WHERE id = $1 AND organization_id = $2 AND is_active`,
    [id, orgId]
  );
  if (!cur[0]) throw Object.assign(new Error('Sitio no encontrado'), { status: 404 });

  const sets = [];
  const vals = [];
  let i = 1;
  if (typeof body.name === 'string' && body.name.trim()) {
    sets.push(`name = $${i++}`);
    vals.push(body.name.trim());
  }
  if (body.locationText !== undefined) {
    const locationText =
      body.locationText == null ? null : String(body.locationText).trim() || null;
    if (locationText && locationText.length > 400) {
      throw Object.assign(new Error('Ubicación máx 400 caracteres'), { status: 400 });
    }
    sets.push(`location_text = $${i++}`);
    vals.push(locationText);
  }
  if (body.notes !== undefined) {
    sets.push(`notes = $${i++}`);
    vals.push(body.notes == null ? null : String(body.notes).trim() || null);
  }
  if (body.latitude != null && body.longitude != null) {
    const { latitude, longitude } = parseCoords(body.latitude, body.longitude);
    sets.push(`latitude = $${i++}`, `longitude = $${i++}`);
    vals.push(latitude, longitude);
  }
  if (body.radiusM !== undefined) {
    if (body.radiusM == null || body.radiusM === '') {
      sets.push(`radius_m = $${i++}`);
      vals.push(null);
    } else {
      const radiusM = Number(body.radiusM);
      if (!Number.isFinite(radiusM) || radiusM <= 0 || radiusM > 50000) {
        throw Object.assign(new Error('radiusM entre 1 y 50000'), { status: 400 });
      }
      sets.push(`radius_m = $${i++}`);
      vals.push(radiusM);
    }
  }
  if (body.groupId) {
    const { rows: g } = await query(
      `SELECT id FROM tactical_site_groups WHERE id = $1 AND organization_id = $2 AND is_active`,
      [body.groupId, orgId]
    );
    if (!g[0]) throw Object.assign(new Error('Grupo destino no encontrado'), { status: 404 });
    sets.push(`group_id = $${i++}`);
    vals.push(body.groupId);
  }
  if (!sets.length) throw Object.assign(new Error('Nada que actualizar'), { status: 400 });
  sets.push('updated_at = NOW()');
  vals.push(id, orgId);
  const { rows } = await query(
    `UPDATE tactical_sites s SET ${sets.join(', ')}
     WHERE s.id = $${i++} AND s.organization_id = $${i}
     RETURNING s.id, s.group_id, s.name, s.location_text, s.notes, s.latitude, s.longitude, s.radius_m,
               s.sort_order, s.is_active, s.created_at`,
    vals
  );
  const { rows: g } = await query(
    `SELECT name, color, icon_url FROM tactical_site_groups WHERE id = $1`,
    [rows[0].group_id]
  );
  return mapSite({
    ...rows[0],
    group_name: g[0]?.name,
    group_color: g[0]?.color,
    group_icon_url: g[0]?.icon_url,
  });
}

export async function deleteTacticalSite(orgId, id) {
  const { rowCount } = await query(
    `UPDATE tactical_sites SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND is_active`,
    [id, orgId]
  );
  if (!rowCount) throw Object.assign(new Error('Sitio no encontrado'), { status: 404 });
}

export async function getTacticalSiteGroupIconRow(orgId, id) {
  const { rows } = await query(
    `SELECT id, icon_url, organization_id FROM tactical_site_groups
     WHERE id = $1 AND organization_id = $2 AND is_active`,
    [id, orgId]
  );
  return rows[0] || null;
}

export async function setTacticalSiteGroupIcon(orgId, id, storedRel) {
  const { rows } = await query(
    `UPDATE tactical_site_groups SET icon_url = $3, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND is_active
     RETURNING id, name, color, icon_url, sort_order, is_active, created_at`,
    [id, orgId, storedRel]
  );
  if (!rows[0]) throw Object.assign(new Error('Grupo no encontrado'), { status: 404 });
  return mapGroup({ ...rows[0], site_count: 0 });
}

export async function clearTacticalSiteGroupIcon(orgId, id) {
  const row = await getTacticalSiteGroupIconRow(orgId, id);
  if (!row) throw Object.assign(new Error('Grupo no encontrado'), { status: 404 });
  await query(
    `UPDATE tactical_site_groups SET icon_url = NULL, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  return row.icon_url || null;
}

export { DEFAULT_COLORS as TACTICAL_SITE_COLORS };
