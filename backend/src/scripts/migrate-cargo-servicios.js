/**
 * Una sola vez: limpia users.cargo que embeben nombres de org_units,
 * asigna unit_id si faltaba, siembra cat_servicios y regenera display_name.
 *
 *   node src/scripts/migrate-cargo-servicios.js
 *   node src/scripts/migrate-cargo-servicios.js --dry
 */
import { query, pool } from '../db.js';
import { buildCallSign } from '../services/rfcUsername.js';
import { splitCargoUnit } from '../services/cargoUnitSplit.js';
import { ensureServiciosCatalog } from '../services/catalogs.js';

const dry = process.argv.includes('--dry');

async function main() {
  const { rows: orgs } = await query(`SELECT id FROM organizations ORDER BY created_at`);
  let updated = 0;
  let assignedUnit = 0;
  let cleanedCargo = 0;

  for (const org of orgs) {
    await ensureServiciosCatalog(org.id);
    const { rows: units } = await query(
      `SELECT id, name, kind FROM org_units
       WHERE organization_id = $1 AND is_active
       ORDER BY CASE kind WHEN 'unit' THEN 0 WHEN 'zone' THEN 1 ELSE 2 END, LENGTH(name) DESC`,
      [org.id]
    );

    const { rows: users } = await query(
      `SELECT id, grade, cargo, paternal_surname, unit_id, display_name
       FROM users WHERE organization_id = $1`,
      [org.id]
    );

    for (const u of users) {
      const split = splitCargoUnit(u.cargo, units);
      let nextCargo = u.cargo;
      let nextUnitId = u.unit_id;
      let changed = false;

      if (split) {
        if (split.servicio !== String(u.cargo || '').trim()) {
          nextCargo = split.servicio;
          cleanedCargo += 1;
          changed = true;
        }
        if (!u.unit_id && split.unitId) {
          nextUnitId = split.unitId;
          assignedUnit += 1;
          changed = true;
        }
      }

      if (nextCargo) {
        await query(
          `INSERT INTO cat_servicios (organization_id, name, sort_order)
           VALUES ($1, $2,
             COALESCE((SELECT MAX(sort_order) + 10 FROM cat_servicios WHERE organization_id = $1), 10))
           ON CONFLICT (organization_id, name) DO NOTHING`,
          [org.id, String(nextCargo).trim()]
        );
      }

      let unitName = null;
      if (nextUnitId) {
        unitName = units.find((x) => x.id === nextUnitId)?.name || null;
      }

      let nextDisplay = u.display_name;
      if (u.grade && u.paternal_surname) {
        try {
          nextDisplay = buildCallSign({
            grade: u.grade,
            paternalSurname: u.paternal_surname,
            cargo: nextCargo,
            unitName,
          });
        } catch {
          /* keep */
        }
      }

      if (nextDisplay !== u.display_name) changed = true;
      if (!changed) continue;

      updated += 1;
      console.log(
        `${dry ? '[dry] ' : ''}${u.id.slice(0, 8)} cargo="${u.cargo}" → "${nextCargo || ''}"` +
          ` unit=${nextUnitId ? 'set' : '—'} sign="${nextDisplay}"`
      );
      if (!dry) {
        await query(
          `UPDATE users SET cargo = $2, unit_id = $3, display_name = $4, updated_at = NOW()
           WHERE id = $1`,
          [u.id, nextCargo, nextUnitId, nextDisplay]
        );
      }
    }
  }

  console.log(
    `\nResumen${dry ? ' (dry)' : ''}: usuarios tocados=${updated}, cargo limpio=${cleanedCargo}, unit_id asignado=${assignedUnit}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
