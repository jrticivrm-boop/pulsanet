import { query } from '../db.js';
import { DEFAULT_EMPLEO_SEED, DEFAULT_GRADE_SEED } from '../data/defaultGrades.js';

export async function ensureDefaultCatalogs(orgId) {
  const { rows: gCount } = await query(
    `SELECT COUNT(*)::int AS n FROM cat_grades WHERE organization_id = $1`,
    [orgId]
  );
  if ((gCount[0]?.n || 0) === 0) {
    for (const g of DEFAULT_GRADE_SEED) {
      await query(
        `INSERT INTO cat_grades (organization_id, name, abbreviation, category, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id, abbreviation) DO NOTHING`,
        [orgId, g.name, g.abbreviation, g.category, g.sortOrder]
      );
    }
  } else {
    // Añadir abreviaturas nuevas (SGTO, B.O., S.O., …) sin borrar las existentes
    for (const g of DEFAULT_GRADE_SEED) {
      await query(
        `INSERT INTO cat_grades (organization_id, name, abbreviation, category, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id, abbreviation) DO NOTHING`,
        [orgId, g.name, g.abbreviation, g.category, g.sortOrder]
      );
    }
  }

  const { rows: eCount } = await query(
    `SELECT COUNT(*)::int AS n FROM cat_empleos WHERE organization_id = $1`,
    [orgId]
  );
  if ((eCount[0]?.n || 0) === 0) {
    let order = 10;
    for (const name of DEFAULT_EMPLEO_SEED) {
      await query(
        `INSERT INTO cat_empleos (organization_id, name, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, name) DO NOTHING`,
        [orgId, name, order]
      );
      order += 10;
    }
  }
}

export async function listGrades(orgId) {
  await ensureDefaultCatalogs(orgId);
  const { rows } = await query(
    `SELECT g.id, g.name, g.abbreviation, g.category, g.sort_order,
            EXISTS (
              SELECT 1 FROM users u
              WHERE u.organization_id = g.organization_id
                AND u.grade IS NOT NULL
                AND TRIM(u.grade) <> ''
                AND LOWER(TRIM(u.grade)) = LOWER(TRIM(g.abbreviation))
            ) AS in_use
     FROM cat_grades g
     WHERE g.organization_id = $1 AND g.is_active
     ORDER BY g.sort_order, g.name`,
    [orgId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    abbreviation: r.abbreviation,
    category: r.category || null,
    sortOrder: r.sort_order,
    inUse: Boolean(r.in_use),
  }));
}

export async function listEmpleos(orgId) {
  await ensureDefaultCatalogs(orgId);
  const { rows } = await query(
    `SELECT e.id, e.name, e.sort_order,
            EXISTS (
              SELECT 1 FROM users u
              WHERE u.organization_id = e.organization_id
                AND u.specialty IS NOT NULL
                AND TRIM(u.specialty) <> ''
                AND LOWER(TRIM(u.specialty)) = LOWER(TRIM(e.name))
            ) AS in_use
     FROM cat_empleos e
     WHERE e.organization_id = $1 AND e.is_active
     ORDER BY e.sort_order, e.name`,
    [orgId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sortOrder: r.sort_order,
    inUse: Boolean(r.in_use),
  }));
}

export async function createGrade(orgId, { name, abbreviation, category }) {
  const abbr = String(abbreviation || name || '').trim();
  const nom = String(name || abbreviation || '').trim();
  if (!abbr || !nom) throw Object.assign(new Error('Nombre y abreviatura son obligatorios'), { status: 400 });
  const { rows } = await query(
    `INSERT INTO cat_grades (organization_id, name, abbreviation, category, sort_order)
     VALUES ($1, $2, $3, $4,
       COALESCE((SELECT MAX(sort_order) + 10 FROM cat_grades WHERE organization_id = $1), 10))
     RETURNING id, name, abbreviation, category, sort_order`,
    [orgId, nom, abbr, category ? String(category).trim() : null]
  );
  return { ...rows[0], sortOrder: rows[0].sort_order, inUse: false };
}

export async function renameGrade(orgId, id, { name, abbreviation, category }) {
  const { rows: cur } = await query(
    `SELECT abbreviation FROM cat_grades WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  if (!cur[0]) throw Object.assign(new Error('Grado no encontrado'), { status: 404 });
  const abbr = String(abbreviation || '').trim() || cur[0].abbreviation;
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre obligatorio'), { status: 400 });
  const { rows } = await query(
    `UPDATE cat_grades SET
       name = $3,
       abbreviation = $4,
       category = COALESCE($5, category),
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING id, name, abbreviation, category, sort_order`,
    [id, orgId, nom, abbr, category != null ? String(category).trim() : null]
  );
  if (cur[0].abbreviation !== abbr) {
    await query(
      `UPDATE users SET grade = $3, updated_at = NOW()
       WHERE organization_id = $1 AND LOWER(TRIM(grade)) = LOWER(TRIM($2))`,
      [orgId, cur[0].abbreviation, abbr]
    );
  }
  return { ...rows[0], sortOrder: rows[0].sort_order };
}

export async function deleteGrade(orgId, id) {
  const { rows } = await query(
    `SELECT abbreviation FROM cat_grades WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  if (!rows[0]) throw Object.assign(new Error('Grado no encontrado'), { status: 404 });
  const { rows: used } = await query(
    `SELECT 1 FROM users
     WHERE organization_id = $1 AND LOWER(TRIM(grade)) = LOWER(TRIM($2))
     LIMIT 1`,
    [orgId, rows[0].abbreviation]
  );
  if (used[0]) throw Object.assign(new Error('En uso — no se puede eliminar'), { status: 409 });
  await query(`DELETE FROM cat_grades WHERE id = $1 AND organization_id = $2`, [id, orgId]);
}

export async function createEmpleo(orgId, { name }) {
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre obligatorio'), { status: 400 });
  const { rows } = await query(
    `INSERT INTO cat_empleos (organization_id, name, sort_order)
     VALUES ($1, $2,
       COALESCE((SELECT MAX(sort_order) + 10 FROM cat_empleos WHERE organization_id = $1), 10))
     RETURNING id, name, sort_order`,
    [orgId, nom]
  );
  return { ...rows[0], sortOrder: rows[0].sort_order, inUse: false };
}

export async function renameEmpleo(orgId, id, { name }) {
  const { rows: cur } = await query(
    `SELECT name FROM cat_empleos WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  if (!cur[0]) throw Object.assign(new Error('Empleo no encontrado'), { status: 404 });
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre obligatorio'), { status: 400 });
  const { rows } = await query(
    `UPDATE cat_empleos SET name = $3, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING id, name, sort_order`,
    [id, orgId, nom]
  );
  await query(
    `UPDATE users SET specialty = $3, updated_at = NOW()
     WHERE organization_id = $1 AND LOWER(TRIM(specialty)) = LOWER(TRIM($2))`,
    [orgId, cur[0].name, nom]
  );
  return { ...rows[0], sortOrder: rows[0].sort_order };
}

export async function deleteEmpleo(orgId, id) {
  const { rows } = await query(
    `SELECT name FROM cat_empleos WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  if (!rows[0]) throw Object.assign(new Error('Empleo no encontrado'), { status: 404 });
  const { rows: used } = await query(
    `SELECT 1 FROM users
     WHERE organization_id = $1 AND LOWER(TRIM(specialty)) = LOWER(TRIM($2))
     LIMIT 1`,
    [orgId, rows[0].name]
  );
  if (used[0]) throw Object.assign(new Error('En uso — no se puede eliminar'), { status: 409 });
  await query(`DELETE FROM cat_empleos WHERE id = $1 AND organization_id = $2`, [id, orgId]);
}
