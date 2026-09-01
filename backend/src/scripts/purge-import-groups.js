/**
 * Elimina grupos/canales creados por import-pv-dependencias
 * (description = "Canal operativo · PV-O-…").
 *
 * Uso: node src/scripts/purge-import-groups.js
 */
import 'dotenv/config';
import { query } from '../db.js';

async function main() {
  const { rows: before } = await query(
    `SELECT id, name, description FROM groups
     WHERE description ILIKE 'Canal operativo%'
        OR livekit_room LIKE 'unit_pv_o_%'`
  );
  console.log(`A eliminar: ${before.length}`);
  if (!before.length) {
    process.exit(0);
  }

  const ids = before.map((g) => g.id);
  // CASCADE limpia members/messages/ptt_* vía FK
  const { rowCount } = await query(`DELETE FROM groups WHERE id = ANY($1::uuid[])`, [ids]);
  console.log(`Eliminados: ${rowCount}`);

  const { rows: left } = await query(`SELECT count(*)::int AS n FROM groups`);
  console.log(`Grupos restantes: ${left[0].n}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
