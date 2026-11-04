import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(
  __dirname,
  '../../../frontend/src/dispatch/ivRmTerritoryCatalog.json'
);

function loadSeedCatalog() {
  try {
    const raw = fs.readFileSync(catalogPath, 'utf8');
    const json = JSON.parse(raw);
    if (!json || !Array.isArray(json.assignments)) return null;
    return json;
  } catch {
    return null;
  }
}

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .trim();
}

function mapRow(r) {
  return {
    id: r.id,
    regionId: r.region_id,
    zoneId: r.zone_id,
    unitId: r.unit_id,
    regionLabel: r.region_label,
    zonaKey: r.zona_key,
    zonaShort: r.zona_short,
    unidadName: r.unidad_name,
    estado: r.estado,
    municipio: r.municipio,
    shapeId: r.shape_id,
  };
}

async function loadOrgUnits(orgId) {
  const { rows } = await query(
    `SELECT id, parent_id, kind, name
     FROM org_units
     WHERE organization_id = $1 AND is_active
     ORDER BY sort_order, name`,
    [orgId]
  );
  return rows;
}

function matchOrg(rows, kind, needle) {
  const n = norm(needle);
  if (!n) return null;
  const poolKind = rows.filter((r) => r.kind === kind);
  return (
    poolKind.find((r) => norm(r.name) === n) ||
    poolKind.find((r) => norm(r.name).includes(n) || n.includes(norm(r.name))) ||
    null
  );
}

async function seedFromCatalog(orgId) {
  const catalog = loadSeedCatalog();
  if (!catalog) return { seeded: false, inserted: 0 };
  const orgs = await loadOrgUnits(orgId);
  const zonaIdByShort = catalog.zonaIdByShort || {};
  const region = matchOrg(orgs, 'region', 'IV R.M.') || matchOrg(orgs, 'region', 'IV');
  let inserted = 0;
  for (const a of catalog.assignments) {
    const zonaShort = String(a.zona || '').trim();
    const zonaKey = zonaIdByShort[zonaShort] || norm(zonaShort).replace(/\//g, '');
    const unidadName = String(a.unidad || '').trim();
    const estado = String(a.estado || '').trim();
    const municipio = String(a.municipio || '').trim();
    if (!unidadName || !estado || !municipio || !zonaKey) continue;
    const zone = matchOrg(orgs, 'zone', zonaShort);
    const unit = matchOrg(orgs, 'unit', unidadName);
    try {
      const { rowCount } = await query(
        `INSERT INTO cat_territory_coverage (
           organization_id, region_id, zone_id, unit_id, region_label,
           zona_key, zona_short, unidad_name, estado, municipio
         ) VALUES ($1,$2,$3,$4,'IV R.M.',$5,$6,$7,$8,$9)
         ON CONFLICT (organization_id, unidad_name, estado, municipio) DO NOTHING`,
        [
          orgId,
          region?.id || null,
          zone?.id || null,
          unit?.id || null,
          zonaKey,
          zonaShort,
          unidadName,
          estado,
          municipio,
        ]
      );
      inserted += rowCount;
    } catch {
      /* unique / missing table handled by caller */
    }
  }
  return { seeded: true, inserted };
}

export async function ensureTerritoryCoverage(orgId) {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM cat_territory_coverage WHERE organization_id = $1`,
      [orgId]
    );
    if ((rows[0]?.n || 0) > 0) return { seeded: false };
    return seedFromCatalog(orgId);
  } catch (err) {
    if (err?.code === '42P01') {
      const e = new Error('Falta la migración 052_territory_coverage.sql');
      e.status = 503;
      throw e;
    }
    throw err;
  }
}

/**
 * Árbol Región → Zona → Unidad SOLO desde cobertura (municipios asignados).
 * Dependencias aporta la etiqueta oficial de la región si existe; no inventa
 * unidades de otras regiones por coincidencia de nombre.
 */
function buildRegionsTree(orgs, mapped) {
  if (!mapped.length) return [];
  const depRegions = orgs.filter((r) => r.kind === 'region');
  const depById = new Map(depRegions.map((r) => [String(r.id), r]));
  const depByName = new Map(depRegions.map((r) => [norm(r.name), r]));

  // Agrupar filas reales de cobertura: región → zona → unidad.
  const byRegion = new Map();
  for (const r of mapped) {
    const dep =
      (r.regionId && depById.get(String(r.regionId))) ||
      depByName.get(norm(r.regionLabel)) ||
      null;
    // Solo regiones que existen en Dependencias (o etiqueta de cobertura si no hay match).
    const regionId = dep ? String(dep.id) : String(r.regionId || `label:${norm(r.regionLabel)}`);
    const regionLabel = dep?.name || r.regionLabel || 'Sin región';
    if (!byRegion.has(regionId)) {
      byRegion.set(regionId, {
        id: regionId,
        label: regionLabel,
        inDependencias: Boolean(dep),
        zonas: new Map(),
      });
    }
    const reg = byRegion.get(regionId);
    const zonaKey = String(r.zonaKey || '').trim();
    if (!zonaKey) continue;
    if (!reg.zonas.has(zonaKey)) {
      reg.zonas.set(zonaKey, {
        id: zonaKey,
        label: r.zonaShort || zonaKey,
        zoneId: r.zoneId,
        units: new Map(),
      });
    }
    const zone = reg.zonas.get(zonaKey);
    const unitName = String(r.unidadName || '').trim();
    if (!unitName || zone.units.has(unitName)) continue;
    zone.units.set(unitName, {
      id: unitName,
      label: unitName,
      unitId: r.unitId,
    });
  }

  return [...byRegion.values()]
    .filter((r) => r.inDependencias)
    .map((r) => ({
      id: r.id,
      label: r.label,
      children: [...r.zonas.values()]
        .filter((z) => z.units.size > 0)
        .map((z) => ({
          id: z.id,
          label: z.label,
          zoneId: z.zoneId,
          children: [...z.units.values()],
        })),
    }))
    .filter((r) => r.children.length > 0);
}

export async function listTerritoryCoverage(orgId) {
  await ensureTerritoryCoverage(orgId);
  const { rows } = await query(
    `SELECT id, region_id, zone_id, unit_id, region_label, zona_key, zona_short,
            unidad_name, estado, municipio, shape_id
     FROM cat_territory_coverage
     WHERE organization_id = $1
     ORDER BY zona_short, unidad_name, estado, municipio`,
    [orgId]
  );
  const mapped = rows.map(mapRow);
  const zonas = [];
  const zonaSeen = new Set();
  const units = [];
  const unitSeen = new Set();
  for (const r of mapped) {
    if (!zonaSeen.has(r.zonaKey)) {
      zonaSeen.add(r.zonaKey);
      zonas.push({ key: r.zonaKey, short: r.zonaShort, regionLabel: r.regionLabel });
    }
    const uk = `${r.zonaKey}|${r.unidadName}`;
    if (!unitSeen.has(uk)) {
      unitSeen.add(uk);
      units.push({
        unidadName: r.unidadName,
        zonaKey: r.zonaKey,
        zonaShort: r.zonaShort,
        regionLabel: r.regionLabel,
        regionId: r.regionId,
        zoneId: r.zoneId,
        unitId: r.unitId,
        municipioCount: mapped.filter(
          (x) => x.zonaKey === r.zonaKey && x.unidadName === r.unidadName
        ).length,
      });
    }
  }
  let regions = [];
  try {
    const orgs = await loadOrgUnits(orgId);
    regions = buildRegionsTree(orgs, mapped);
  } catch {
    regions = buildRegionsTree([], mapped);
  }
  let unitColors = {};
  try {
    unitColors = await listUnitColorsMap(orgId);
  } catch {
    unitColors = {};
  }
  return { rows: mapped, zonas, units, regions, unitColors };
}

function colorKey(zonaKey, unidadName) {
  return `${String(zonaKey || '').trim()}|${String(unidadName || '').trim()}`;
}

async function listUnitColorsMap(orgId) {
  const { rows } = await query(
    `SELECT zona_key, unidad_name, color
     FROM cat_territory_unit_colors
     WHERE organization_id = $1`,
    [orgId]
  );
  const out = {};
  for (const r of rows) {
    out[colorKey(r.zona_key, r.unidad_name)] = String(r.color || '').toLowerCase();
  }
  return out;
}

export async function upsertUnitColor(orgId, body = {}) {
  const unidadName = cleanText(body.unidadName, 120);
  const zonaKey = cleanText(body.zonaKey, 32);
  let color = String(body.color || '').trim().toLowerCase();
  if (!unidadName) {
    const e = new Error('unidadName es obligatorio');
    e.status = 400;
    throw e;
  }
  if (!/^#[0-9a-f]{6}$/.test(color)) {
    const e = new Error('color debe ser #rrggbb');
    e.status = 400;
    throw e;
  }
  try {
    await query(
      `INSERT INTO cat_territory_unit_colors (organization_id, zona_key, unidad_name, color, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (organization_id, zona_key, unidad_name)
       DO UPDATE SET color = EXCLUDED.color, updated_at = NOW()`,
      [orgId, zonaKey, unidadName, color]
    );
  } catch (err) {
    if (err?.code === '42P01') {
      const e = new Error('Falta la migración 053_territory_ui_prefs_colors.sql');
      e.status = 503;
      throw e;
    }
    throw err;
  }
  return listUnitColorsMap(orgId);
}

function cleanText(value, max) {
  const s = String(value || '').trim();
  return s.slice(0, max);
}

export async function replaceCoverageForEstado(orgId, body = {}) {
  const unidadName = cleanText(body.unidadName, 120);
  const zonaKey = cleanText(body.zonaKey, 32);
  const zonaShort = cleanText(body.zonaShort, 32) || zonaKey;
  const regionLabel = cleanText(body.regionLabel, 80) || 'IV R.M.';
  const estado = cleanText(body.estado, 80);
  const municipios = Array.isArray(body.municipios)
    ? [...new Set(body.municipios.map((m) => cleanText(m, 120)).filter(Boolean))]
    : [];
  if (!unidadName || !zonaKey || !estado) {
    const e = new Error('unidadName, zonaKey y estado son obligatorios');
    e.status = 400;
    throw e;
  }
  const regionId = body.regionId || null;
  const zoneId = body.zoneId || null;
  const unitId = body.unitId || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM cat_territory_coverage
       WHERE organization_id = $1
         AND zona_key = $2
         AND unidad_name = $3
         AND LOWER(TRIM(estado)) = LOWER(TRIM($4))`,
      [orgId, zonaKey, unidadName, estado]
    );
    for (const municipio of municipios) {
      await client.query(
        `INSERT INTO cat_territory_coverage (
           organization_id, region_id, zone_id, unit_id, region_label,
           zona_key, zona_short, unidad_name, estado, municipio
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          orgId,
          regionId,
          zoneId,
          unitId,
          regionLabel,
          zonaKey,
          zonaShort,
          unidadName,
          estado,
          municipio,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
  const data = await listTerritoryCoverage(orgId);
  return {
    ...data,
    saved: {
      unidadName,
      zonaKey,
      zonaShort,
      regionLabel,
      estado,
      municipios: municipios.length,
    },
  };
}
