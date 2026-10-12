import { query } from '../db.js';

/** La consola consulta hasta 31 días atrás (trackRange.js); margen de 4 días. 0 = sin purga. */
const RETENTION_DAYS = (() => {
  const n = parseInt(process.env.LOCATION_RETENTION_DAYS ?? '35', 10);
  return Number.isFinite(n) && n >= 0 ? n : 35;
})();
const BATCH_ROWS = 5_000;
const MAX_BATCHES_PER_RUN = 400;
const PAUSE_MS = 200;
const FIRST_RUN_MS = 5 * 60_000;
const EVERY_MS = 6 * 3_600_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let running = false;

/** Borra ubicaciones más viejas que la retención, en lotes cortos para no bloquear la tabla. */
export async function purgeOldLocations() {
  if (!RETENTION_DAYS || running) return 0;
  running = true;
  let total = 0;
  try {
    for (let i = 0; i < MAX_BATCHES_PER_RUN; i += 1) {
      const { rowCount } = await query(
        `DELETE FROM locations
         WHERE id IN (
           SELECT id FROM locations
           WHERE recorded_at < NOW() - make_interval(days => $1)
           LIMIT $2
         )`,
        [RETENTION_DAYS, BATCH_ROWS]
      );
      total += rowCount || 0;
      if ((rowCount || 0) < BATCH_ROWS) break;
      await sleep(PAUSE_MS);
    }
    if (total) {
      console.log(`[Ubicaciones] purga: ${total} filas > ${RETENTION_DAYS} días`);
    }
  } catch (err) {
    console.error('[Ubicaciones] purga:', err.message);
  } finally {
    running = false;
  }
  return total;
}

export function startLocationRetention() {
  if (!RETENTION_DAYS) {
    console.log('[Ubicaciones] retención desactivada (LOCATION_RETENTION_DAYS=0)');
    return;
  }
  setTimeout(() => void purgeOldLocations(), FIRST_RUN_MS).unref?.();
  setInterval(() => void purgeOldLocations(), EVERY_MS).unref?.();
  console.log(`[Ubicaciones] retención ${RETENTION_DAYS} días (purga cada 6 h)`);
}
