/**
 * Renombra usuarios con estilo RFC antiguo al formato ggomezd2.
 * Caso Guadalupe Gómez de la Cruz: GODG900516 → ggomezd2
 */
import { query } from '../db.js';
import { buildUsername } from '../services/rfcUsername.js';

async function migrate() {
  const { rows } = await query(
    `SELECT id, organization_id, username, display_name
     FROM users
     WHERE username ~ '^[A-Z]{4}[0-9]{6}$'
        OR username = 'GODG900516'`
  );

  for (const u of rows) {
    // Intentar parsear display_name: "Nombre ApellidoPaterno ApellidoMaterno..."
    const parts = String(u.display_name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length < 2) {
      console.log(`Omitido ${u.username}: no se puede inferir nombre`);
      continue;
    }

    // Heurística: primer token = nombre(s) hasta el penúltimo apellido compuesto
    // Guadalupe Gomez de la Cruz → given=Guadalupe, paternal=Gomez, maternal=de la Cruz
    let givenNames;
    let paternalSurname;
    let maternalSurname = '';
    if (parts.length === 2) {
      givenNames = parts[0];
      paternalSurname = parts[1];
    } else if (parts.length === 3) {
      givenNames = parts[0];
      paternalSurname = parts[1];
      maternalSurname = parts[2];
    } else {
      // 4+: nombre = primero; paterno = segundo; materno = resto
      // (Guadalupe | Gomez | de la Cruz)
      givenNames = parts[0];
      paternalSurname = parts[1];
      maternalSurname = parts.slice(2).join(' ');
    }

    const built = await buildUsername(
      { givenNames, paternalSurname, maternalSurname },
      async (candidate) => {
        const { rows: taken } = await query(
          `SELECT 1 FROM users
           WHERE organization_id = $1 AND LOWER(username) = LOWER($2) AND id <> $3
           LIMIT 1`,
          [u.organization_id, candidate, u.id]
        );
        return Boolean(taken[0]);
      }
    );

    await query(
      `UPDATE users SET
         username = $2,
         email = $3,
         updated_at = NOW()
       WHERE id = $1`,
      [u.id, built.username, `${built.username}@tacticalptx.local`]
    );
    console.log(`${u.username} → ${built.username}  (${u.display_name})`);
  }

  console.log('Migración de usuarios OK');
}

migrate().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
