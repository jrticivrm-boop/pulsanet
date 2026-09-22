import { query } from '../db.js';
import {
  DEFAULT_EMPLEO_SEED,
  DEFAULT_GRADE_SEED,
  DEFAULT_JERARQUIA_SEED,
} from '../data/defaultGrades.js';

async function ensureJerarquiasTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS cat_jerarquias (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(80) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (organization_id, name)
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_cat_jerarquias_org
      ON cat_jerarquias (organization_id, sort_order, name)
  `);
}

export async function ensureDefaultCatalogs(orgId) {
  await ensureJerarquiasTable();

  await query(
    `UPDATE cat_grades SET abbreviation = 'Myr.', updated_at = NOW()
     WHERE organization_id = $1 AND name = 'Mayor' AND abbreviation = 'May.'`,
    [orgId]
  );
  await query(
    `UPDATE users SET grade = 'Myr.', updated_at = NOW()
     WHERE organization_id = $1 AND LOWER(TRIM(grade)) = 'may.'`,
    [orgId]
  );

  // Jerarquías: semilla + categorías ya usadas en grados
  for (const j of DEFAULT_JERARQUIA_SEED) {
    await query(
      `INSERT INTO cat_jerarquias (organization_id, name, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, name) DO NOTHING`,
      [orgId, j.name, j.sortOrder]
    );
  }
  await query(
    `INSERT INTO cat_jerarquias (organization_id, name, sort_order)
     SELECT DISTINCT g.organization_id, TRIM(g.category),
       COALESCE((SELECT MAX(sort_order) + 10 FROM cat_jerarquias j WHERE j.organization_id = g.organization_id), 100)
     FROM cat_grades g
     WHERE g.organization_id = $1
       AND g.category IS NOT NULL
       AND TRIM(g.category) <> ''
     ON CONFLICT (organization_id, name) DO NOTHING`,
    [orgId]
  );
  // Reactivar jerarquía si estaba soft-deleted pero hay grados activos con esa categoría
  await query(
    `UPDATE cat_jerarquias j SET is_active = TRUE, updated_at = NOW()
     WHERE j.organization_id = $1
       AND j.is_active = FALSE
       AND EXISTS (
         SELECT 1 FROM cat_grades g
         WHERE g.organization_id = j.organization_id
           AND g.is_active
           AND LOWER(TRIM(g.category)) = LOWER(TRIM(j.name))
       )`,
    [orgId]
  );

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
    // Solo inserta abreviaturas nuevas; no revive filas soft-deleted (UNIQUE sigue ocupado).
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

export async function listJerarquias(orgId) {
  await ensureDefaultCatalogs(orgId);
  const { rows } = await query(
    `SELECT j.id, j.name, j.sort_order,
            EXISTS (
              SELECT 1 FROM cat_grades g
              WHERE g.organization_id = j.organization_id
                AND g.is_active
                AND g.category IS NOT NULL
                AND LOWER(TRIM(g.category)) = LOWER(TRIM(j.name))
            ) AS in_use
     FROM cat_jerarquias j
     WHERE j.organization_id = $1 AND j.is_active
     ORDER BY j.sort_order, j.name`,
    [orgId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sortOrder: r.sort_order,
    inUse: Boolean(r.in_use),
  }));
}

export async function createJerarquia(orgId, { name }) {
  await ensureJerarquiasTable();
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre obligatorio'), { status: 400 });
  // Si existía soft-deleted, reactivar
  const { rows: soft } = await query(
    `SELECT id FROM cat_jerarquias
     WHERE organization_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND is_active = FALSE`,
    [orgId, nom]
  );
  if (soft[0]) {
    const { rows } = await query(
      `UPDATE cat_jerarquias SET is_active = TRUE, name = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, sort_order`,
      [soft[0].id, orgId, nom]
    );
    return { ...rows[0], sortOrder: rows[0].sort_order, inUse: false };
  }
  const { rows } = await query(
    `INSERT INTO cat_jerarquias (organization_id, name, sort_order)
     VALUES ($1, $2,
       COALESCE((SELECT MAX(sort_order) + 10 FROM cat_jerarquias WHERE organization_id = $1), 10))
     RETURNING id, name, sort_order`,
    [orgId, nom]
  );
  return { ...rows[0], sortOrder: rows[0].sort_order, inUse: false };
}

export async function renameJerarquia(orgId, id, { name }) {
  const { rows: cur } = await query(
    `SELECT name FROM cat_jerarquias WHERE id = $1 AND organization_id = $2 AND is_active`,
    [id, orgId]
  );
  if (!cur[0]) throw Object.assign(new Error('Jerarquía no encontrada'), { status: 404 });
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre obligatorio'), { status: 400 });
  const { rows } = await query(
    `UPDATE cat_jerarquias SET name = $3, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING id, name, sort_order`,
    [id, orgId, nom]
  );
  if (cur[0].name !== nom) {
    await query(
      `UPDATE cat_grades SET category = $3, updated_at = NOW()
       WHERE organization_id = $1 AND LOWER(TRIM(category)) = LOWER(TRIM($2))`,
      [orgId, cur[0].name, nom]
    );
  }
  return { ...rows[0], sortOrder: rows[0].sort_order };
}

export async function reorderJerarquias(orgId, ids) {
  await ensureJerarquiasTable();
  const ordered = [
    ...new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => String(id || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  if (!ordered.length) {
    throw Object.assign(new Error('Orden vacío'), { status: 400 });
  }
  const { rows: existing } = await query(
    `SELECT lower(id::text) AS id FROM cat_jerarquias
     WHERE organization_id = $1 AND is_active`,
    [orgId]
  );
  const existingIds = existing.map((r) => r.id);
  const existingSet = new Set(existingIds);
  for (const id of ordered) {
    if (!existingSet.has(id)) {
      throw Object.assign(new Error('Jerarquía inválida en el orden'), { status: 400 });
    }
  }
  // Conserva al final las que no vinieron en el payload (lista incompleta / carrera).
  const finalOrder = [...ordered, ...existingIds.filter((id) => !ordered.includes(id))];
  for (let i = 0; i < finalOrder.length; i += 1) {
    await query(
      `UPDATE cat_jerarquias SET sort_order = $3, updated_at = NOW()
       WHERE id = $1::uuid AND organization_id = $2 AND is_active`,
      [finalOrder[i], orgId, (i + 1) * 10]
    );
  }
  return listJerarquias(orgId);
}

export async function reorderGrades(orgId, ids) {
  const ordered = [
    ...new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => String(id || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  if (!ordered.length) {
    throw Object.assign(new Error('Orden vacío'), { status: 400 });
  }
  const { rows: existing } = await query(
    `SELECT lower(id::text) AS id FROM cat_grades
     WHERE organization_id = $1 AND is_active`,
    [orgId]
  );
  const existingIds = existing.map((r) => r.id);
  const existingSet = new Set(existingIds);
  for (const id of ordered) {
    if (!existingSet.has(id)) {
      throw Object.assign(new Error('Grado inválido en el orden'), { status: 400 });
    }
  }
  const finalOrder = [...ordered, ...existingIds.filter((id) => !ordered.includes(id))];
  for (let i = 0; i < finalOrder.length; i += 1) {
    await query(
      `UPDATE cat_grades SET sort_order = $3, updated_at = NOW()
       WHERE id = $1::uuid AND organization_id = $2 AND is_active`,
      [finalOrder[i], orgId, (i + 1) * 10]
    );
  }
  return listGrades(orgId);
}

export async function deleteJerarquia(orgId, id) {
  const { rows } = await query(
    `SELECT name FROM cat_jerarquias WHERE id = $1 AND organization_id = $2 AND is_active`,
    [id, orgId]
  );
  if (!rows[0]) throw Object.assign(new Error('Jerarquía no encontrada'), { status: 404 });
  const { rows: used } = await query(
    `SELECT 1 FROM cat_grades
     WHERE organization_id = $1 AND is_active
       AND LOWER(TRIM(category)) = LOWER(TRIM($2))
     LIMIT 1`,
    [orgId, rows[0].name]
  );
  if (used[0]) {
    throw Object.assign(
      new Error('En uso por grados — no se puede eliminar'),
      { status: 409 }
    );
  }
  await query(
    `UPDATE cat_jerarquias SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
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
  const cat = category ? String(category).trim() : null;
  if (cat) {
    await ensureJerarquiasTable();
    await query(
      `INSERT INTO cat_jerarquias (organization_id, name, sort_order)
       VALUES ($1, $2,
         COALESCE((SELECT MAX(sort_order) + 10 FROM cat_jerarquias WHERE organization_id = $1), 10))
       ON CONFLICT (organization_id, name) DO UPDATE SET is_active = TRUE, updated_at = NOW()`,
      [orgId, cat]
    );
  }
  // Soft-deleted misma abreviatura → reactivar
  const { rows: soft } = await query(
    `SELECT id FROM cat_grades
     WHERE organization_id = $1 AND LOWER(TRIM(abbreviation)) = LOWER(TRIM($2)) AND is_active = FALSE`,
    [orgId, abbr]
  );
  if (soft[0]) {
    const { rows } = await query(
      `UPDATE cat_grades SET
         is_active = TRUE, name = $3, abbreviation = $4, category = $5, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, abbreviation, category, sort_order`,
      [soft[0].id, orgId, nom, abbr, cat]
    );
    return { ...rows[0], sortOrder: rows[0].sort_order, inUse: false };
  }
  const { rows } = await query(
    `INSERT INTO cat_grades (organization_id, name, abbreviation, category, sort_order)
     VALUES ($1, $2, $3, $4,
       COALESCE((SELECT MAX(sort_order) + 10 FROM cat_grades WHERE organization_id = $1), 10))
     RETURNING id, name, abbreviation, category, sort_order`,
    [orgId, nom, abbr, cat]
  );
  return { ...rows[0], sortOrder: rows[0].sort_order, inUse: false };
}

export async function renameGrade(orgId, id, { name, abbreviation, category }) {
  const { rows: cur } = await query(
    `SELECT abbreviation FROM cat_grades WHERE id = $1 AND organization_id = $2 AND is_active`,
    [id, orgId]
  );
  if (!cur[0]) throw Object.assign(new Error('Grado no encontrado'), { status: 404 });
  const abbr = String(abbreviation || '').trim() || cur[0].abbreviation;
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre obligatorio'), { status: 400 });
  const cat = category != null ? String(category).trim() || null : null;
  if (cat) {
    await query(
      `INSERT INTO cat_jerarquias (organization_id, name, sort_order)
       VALUES ($1, $2,
         COALESCE((SELECT MAX(sort_order) + 10 FROM cat_jerarquias WHERE organization_id = $1), 10))
       ON CONFLICT (organization_id, name) DO UPDATE SET is_active = TRUE, updated_at = NOW()`,
      [orgId, cat]
    );
  }
  const { rows } = await query(
    `UPDATE cat_grades SET
       name = $3,
       abbreviation = $4,
       category = COALESCE($5, category),
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING id, name, abbreviation, category, sort_order`,
    [id, orgId, nom, abbr, cat]
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
    `SELECT abbreviation FROM cat_grades WHERE id = $1 AND organization_id = $2 AND is_active`,
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
  // Soft-delete: evita que el seed lo vuelva a insertar (UNIQUE abbreviation).
  await query(
    `UPDATE cat_grades SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
}

export async function createEmpleo(orgId, { name }) {
  const nom = String(name || '').trim();
  if (!nom) throw Object.assign(new Error('Nombre obligatorio'), { status: 400 });
  const { rows: soft } = await query(
    `SELECT id FROM cat_empleos
     WHERE organization_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND is_active = FALSE`,
    [orgId, nom]
  );
  if (soft[0]) {
    const { rows } = await query(
      `UPDATE cat_empleos SET is_active = TRUE, name = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, sort_order`,
      [soft[0].id, orgId, nom]
    );
    return { ...rows[0], sortOrder: rows[0].sort_order, inUse: false };
  }
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
    `SELECT name FROM cat_empleos WHERE id = $1 AND organization_id = $2 AND is_active`,
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
    `SELECT name FROM cat_empleos WHERE id = $1 AND organization_id = $2 AND is_active`,
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
  await query(
    `UPDATE cat_empleos SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
}
