/**
 * Regenera display_name: Grado Apellido[, unidad|zona|región].
 * Uso: node src/scripts/rebuild-callsigns.js [--dry-run]
 */
import { query } from '../db.js';
import { buildCallSign } from '../services/rfcUsername.js';
import { resolveAffiliationLabel } from '../services/orgAffiliation.js';

const dry = process.argv.includes('--dry-run');

async function main() {
  const { rows } = await query(
    `SELECT id, organization_id, username, grade, paternal_surname, unit_id,
            admin_scope_unit_id, display_name, cargo, service_nombre, role
     FROM users
     WHERE grade IS NOT NULL AND TRIM(grade) <> ''
       AND paternal_surname IS NOT NULL AND TRIM(paternal_surname) <> ''
     ORDER BY username`
  );

  let updated = 0;
  let skipped = 0;
  for (const u of rows) {
    let next;
    try {
      const affiliationLabel = await resolveAffiliationLabel(u.organization_id, {
        unitId: u.unit_id,
        adminScopeUnitId: u.admin_scope_unit_id,
      });
      next = buildCallSign({
        grade: u.grade,
        paternalSurname: u.paternal_surname,
        role: u.role,
        affiliationLabel,
        unitName: affiliationLabel,
      });
    } catch (e) {
      console.warn(`skip ${u.username}: ${e.message}`);
      skipped += 1;
      continue;
    }
    if (next === u.display_name) continue;
    console.log(
      `${u.username}: «${u.display_name}» → «${next}»` +
        (u.cargo || u.service_nombre
          ? `  [cargo=${u.cargo || '—'} nombre=${u.service_nombre || '—'}]`
          : '')
    );
    if (!dry) {
      await query(`UPDATE users SET display_name = $2, updated_at = NOW() WHERE id = $1`, [
        u.id,
        next,
      ]);
    }
    updated += 1;
  }
  console.log(
    dry
      ? `Dry-run: ${updated} cambios, ${skipped} omitidos`
      : `Actualizados: ${updated}, omitidos: ${skipped}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
