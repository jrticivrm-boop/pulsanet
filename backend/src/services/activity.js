import { query } from '../db.js';

/**
 * Registra un evento de auditoría. Fallos se loguean y no rompen el request.
 */
export async function logActivity({
  organizationId = null,
  actorId = null,
  action,
  entityType = null,
  entityId = null,
  meta = null,
}) {
  if (!action) return;
  try {
    await query(
      `INSERT INTO activity_logs (organization_id, actor_id, action, entity_type, entity_id, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        organizationId,
        actorId,
        action,
        entityType,
        entityId,
        meta ? JSON.stringify(meta) : null,
      ]
    );
  } catch (err) {
    console.error('activity_logs:', err.message);
  }
}
