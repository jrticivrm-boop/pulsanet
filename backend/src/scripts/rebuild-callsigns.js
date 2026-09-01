/**
 * Regenera display_name (indicativo) desde grado + apellido paterno.
 * Uso: node src/scripts/rebuild-callsigns.js [--dry-run]
 *
 * No toca el username de login. Solo actualiza display_name cuando hay grade + paternal_surname.
 */
import { query } from '../db.js';
import { buildCallSign } from '../services/rfcUsername.js';

const dry = process.argv.includes('--dry-run');

async function main() {
  const { rows } = await query(
    `SELECT id, username, grade, paternal_surname, maternal_surname, cargo, specialty, display_name
     FROM users
     WHERE grade IS NOT NULL AND TRIM(grade) <> ''
       AND paternal_surname IS NOT NULL AND TRIM(paternal_surname) <> ''
     ORDER BY username`
  );

  let updated = 0;
  for (const u of rows) {
    let next;
    try {
      next = buildCallSign({
        grade: u.grade,
        paternalSurname: u.paternal_surname,
        cargo: u.cargo,
        specialty: u.specialty,
      });
    } catch (e) {
      console.warn(`skip ${u.username}: ${e.message}`);
      continue;
    }
    if (next === u.display_name) continue;
    console.log(`${u.username}: «${u.display_name}» → «${next}»`);
    if (!dry) {
      await query(`UPDATE users SET display_name = $2, updated_at = NOW() WHERE id = $1`, [
        u.id,
        next,
      ]);
    }
    updated += 1;
  }
  console.log(dry ? `Dry-run: ${updated} cambios` : `Actualizados: ${updated}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
