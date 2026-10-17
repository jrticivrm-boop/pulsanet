import { query } from '../db.js';

/**
 * Resuelve nombres de adscripción desde unit_id / admin_scope_unit_id.
 * Etiqueta visible: unidad → si no, zona → si no, región.
 */
export async function resolveOrgAffiliation(orgId, { unitId, adminScopeUnitId } = {}) {
  const anchor = unitId || adminScopeUnitId || null;
  if (!anchor || !orgId) {
    return { unitName: null, zoneName: null, regionName: null, label: null };
  }

  const { rows } = await query(
    `WITH RECURSIVE chain AS (
       SELECT id, name, kind, parent_id
       FROM org_units
       WHERE id = $1 AND organization_id = $2 AND is_active
       UNION ALL
       SELECT o.id, o.name, o.kind, o.parent_id
       FROM org_units o
       INNER JOIN chain c ON o.id = c.parent_id
       WHERE o.organization_id = $2 AND o.is_active
     )
     SELECT name, kind FROM chain`,
    [anchor, orgId]
  );

  let unitName = null;
  let zoneName = null;
  let regionName = null;
  for (const r of rows) {
    if (r.kind === 'unit' && !unitName) unitName = r.name;
    if (r.kind === 'zone' && !zoneName) zoneName = r.name;
    if (r.kind === 'region' && !regionName) regionName = r.name;
  }

  const label = unitName || zoneName || regionName || null;
  return { unitName, zoneName, regionName, label };
}

/** Solo el texto de pertenencia (unidad | zona | región). */
export async function resolveAffiliationLabel(orgId, { unitId, adminScopeUnitId } = {}) {
  const aff = await resolveOrgAffiliation(orgId, { unitId, adminScopeUnitId });
  return aff.label;
}
