import { query } from '../db.js';
import { openMessageBody } from './contentCrypto.js';

const MEDIA_LABEL = {
  image: 'foto',
  audio: 'audio',
  file: 'archivo',
  sticker: 'sticker',
  location: 'ubicación',
  nudge: 'toque',
  system: 'sistema',
};

function clip(s, n = 80) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function messageSummary(row, subjectUserId) {
  const peerName = row.peer_name || 'alguien';
  const groupName = row.group_name || 'grupo';
  const isDm = !row.group_id;
  const sent = String(row.sender_id) === String(subjectUserId);
  const typ = row.type || 'text';

  if (isDm) {
    if (typ === 'text') {
      const body = clip(openMessageBody(typ, row.body));
      if (sent) return body ? `Envió a ${peerName}: «${body}»` : `Envió mensaje a ${peerName}`;
      return body ? `Recibió de ${peerName}: «${body}»` : `Recibió mensaje de ${peerName}`;
    }
    const label = MEDIA_LABEL[typ] || typ;
    return sent ? `Envió ${label} a ${peerName}` : `Recibió ${label} de ${peerName}`;
  }

  if (typ === 'text') {
    const body = clip(openMessageBody(typ, row.body));
    if (sent) {
      return body ? `Envió en «${groupName}»: «${body}»` : `Envió mensaje en «${groupName}»`;
    }
    return body
      ? `Mensaje en «${groupName}» de ${peerName}: «${body}»`
      : `Mensaje en «${groupName}» de ${peerName}`;
  }
  const label = MEDIA_LABEL[typ] || typ;
  return sent
    ? `Envió ${label} en «${groupName}»`
    : `${peerName} envió ${label} en «${groupName}»`;
}

function fmtDuration(sec) {
  const s = Math.max(0, Number(sec) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${String(r).padStart(2, '0')}` : `${m} min`;
}

function callSummary(row, subjectUserId) {
  const isCaller = String(row.caller_id) === String(subjectUserId);
  const peer = row.peer_name || 'alguien';
  const mode =
    row.mode === 'video' ? 'video' : row.mode === 'radio' ? 'radio' : 'voz';
  const outcome = row.outcome || 'completed';
  const dur =
    row.duration_sec != null && Number(row.duration_sec) > 0
      ? `, ${fmtDuration(row.duration_sec)}`
      : '';

  if (outcome === 'missed' || outcome === 'no_answer' || outcome === 'rejected') {
    if (isCaller) return `Llamada ${mode} perdida a ${peer}`;
    return `Llamada ${mode} perdida de ${peer}`;
  }
  if (isCaller) return `Llamó a ${peer} (${mode}${dur})`;
  return `Recibió llamada de ${peer} (${mode}${dur})`;
}

function wantKind(filter, kind) {
  if (!filter) return true;
  return filter === kind;
}

/**
 * Timeline unificada: user_events + mensajes + llamadas + pánico + PTT.
 */
export async function buildUserTimeline({
  orgId,
  userId,
  kind = '',
  from = null,
  to = null,
  limit = 200,
}) {
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const events = [];
  const persistedKinds = new Set(['geofence', 'account', 'session', 'presence']);

  // --- user_events (geofence, account, session, presence, …) ---
  if (!kind || persistedKinds.has(kind)) {
    const params = [orgId, userId];
    const filters = ['e.organization_id = $1', 'e.subject_user_id = $2'];
    if (kind && persistedKinds.has(kind)) {
      params.push(kind);
      filters.push(`e.kind = $${params.length}`);
    }
    if (from) {
      params.push(from);
      filters.push(`e.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      filters.push(`e.created_at <= $${params.length}`);
    }
    params.push(lim);
    const { rows } = await query(
      `SELECT e.id, e.kind, e.summary, e.meta, e.created_at
       FROM user_events e
       WHERE ${filters.join(' AND ')}
       ORDER BY e.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    for (const r of rows) {
      events.push({
        id: `ue:${r.id}`,
        kind: r.kind,
        summary: r.summary,
        meta: r.meta || null,
        createdAt: r.created_at,
        source: 'user_events',
      });
    }
  }

  // --- Mensajes (DM + grupo) ---
  if (wantKind(kind, 'message') || !kind) {
    const params = [orgId, userId];
    let timeFilter = '';
    if (from) {
      params.push(from);
      timeFilter += ` AND m.created_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      timeFilter += ` AND m.created_at <= $${params.length}`;
    }
    params.push(lim);
    const { rows } = await query(
      `SELECT m.id, m.group_id, m.sender_id, m.recipient_id, m.type, m.body, m.media_name,
              m.created_at, m.deleted_at,
              CASE
                WHEN m.group_id IS NULL AND m.sender_id = $2 THEN ru.display_name
                WHEN m.group_id IS NULL AND m.recipient_id = $2 THEN su.display_name
                ELSE su.display_name
              END AS peer_name,
              CASE
                WHEN m.group_id IS NULL AND m.sender_id = $2 THEN m.recipient_id
                WHEN m.group_id IS NULL AND m.recipient_id = $2 THEN m.sender_id
                ELSE NULL
              END AS peer_id,
              g.name AS group_name
       FROM messages m
       LEFT JOIN users su ON su.id = m.sender_id
       LEFT JOIN users ru ON ru.id = m.recipient_id
       LEFT JOIN groups g ON g.id = m.group_id
       WHERE m.deleted_at IS NULL
         AND m.type <> 'system'
         AND (
           (m.group_id IS NULL AND m.recipient_id IS NOT NULL
             AND (m.sender_id = $2 OR m.recipient_id = $2)
             AND EXISTS (
               SELECT 1 FROM users ux
               WHERE ux.id = $2 AND ux.organization_id = $1
             ))
           OR
           (m.group_id IS NOT NULL
             AND g.organization_id = $1
             AND (m.sender_id = $2 OR EXISTS (
               SELECT 1 FROM group_members gm
               WHERE gm.group_id = m.group_id AND gm.user_id = $2
             )))
         )
         ${timeFilter}
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    for (const r of rows) {
      // Solo mensajes donde el sujeto envió O recibió en DM;
      // en grupo: enviados por él, o (si queremos D2) todos del grupo — mostramos enviados + recibidos en grupos donde es miembro
      const isDm = !r.group_id;
      const sent = String(r.sender_id) === String(userId);
      if (!isDm && !sent) {
        // mensaje de otro en su grupo: incluir (le "llegó" en el canal)
      }
      events.push({
        id: `msg:${r.id}`,
        kind: 'message',
        summary: messageSummary(r, userId),
        meta: {
          messageId: r.id,
          peerId: r.peer_id || null,
          peerName: r.peer_name || null,
          groupId: r.group_id || null,
          groupName: r.group_name || null,
          type: r.type,
          direction: sent ? 'out' : 'in',
          canOpen: true,
        },
        createdAt: r.created_at,
        source: 'messages',
      });
    }
  }

  // --- Llamadas ---
  if (wantKind(kind, 'call') || !kind) {
    const params = [orgId, userId];
    let timeFilter = '';
    if (from) {
      params.push(from);
      timeFilter += ` AND l.ended_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      timeFilter += ` AND l.ended_at <= $${params.length}`;
    }
    params.push(lim);
    const { rows } = await query(
      `SELECT l.id, l.caller_id, l.target_id, l.mode, l.outcome, l.duration_sec, l.ended_at,
              CASE WHEN l.caller_id = $2 THEN tu.display_name ELSE cu.display_name END AS peer_name,
              CASE WHEN l.caller_id = $2 THEN l.target_id ELSE l.caller_id END AS peer_id
       FROM private_call_logs l
       JOIN users cu ON cu.id = l.caller_id
       JOIN users tu ON tu.id = l.target_id
       WHERE l.organization_id = $1
         AND (l.caller_id = $2 OR l.target_id = $2)
         ${timeFilter}
       ORDER BY l.ended_at DESC
       LIMIT $${params.length}`,
      params
    );
    for (const r of rows) {
      events.push({
        id: `call:${r.id}`,
        kind: 'call',
        summary: callSummary(r, userId),
        meta: {
          callId: r.id,
          peerId: r.peer_id,
          peerName: r.peer_name,
          mode: r.mode,
          outcome: r.outcome,
        },
        createdAt: r.ended_at,
        source: 'calls',
      });
    }
  }

  // --- Pánico ---
  if (wantKind(kind, 'panic') || !kind) {
    const params = [orgId, userId];
    let timeFilter = '';
    if (from) {
      params.push(from);
      timeFilter += ` AND p.created_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      timeFilter += ` AND p.created_at <= $${params.length}`;
    }
    params.push(lim);
    const { rows } = await query(
      `SELECT p.id, p.status, p.created_at, p.resolved_at
       FROM panic_events p
       WHERE p.organization_id = $1 AND p.user_id = $2
         ${timeFilter}
       ORDER BY p.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    for (const r of rows) {
      events.push({
        id: `panic:${r.id}`,
        kind: 'panic',
        summary: 'Activó alerta',
        meta: { panicId: r.id, status: r.status },
        createdAt: r.created_at,
        source: 'panic',
      });
      if (r.resolved_at && r.status !== 'active') {
        events.push({
          id: `panic-end:${r.id}`,
          kind: 'panic',
          summary:
            r.status === 'cancelled'
              ? 'Canceló / se canceló su alerta'
              : 'Su alerta fue atendida',
          meta: { panicId: r.id, status: r.status },
          createdAt: r.resolved_at,
          source: 'panic',
        });
      }
    }
  }

  // --- Radio / PTT ---
  if (wantKind(kind, 'radio') || !kind) {
    const params = [orgId, userId];
    let timeFilter = '';
    if (from) {
      params.push(from);
      timeFilter += ` AND s.started_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      timeFilter += ` AND s.started_at <= $${params.length}`;
    }
    params.push(lim);
    const { rows } = await query(
      `SELECT s.id, s.group_id, s.started_at, s.ended_at, s.duration_ms, g.name AS group_name
       FROM ptt_sessions s
       JOIN groups g ON g.id = s.group_id
       WHERE s.user_id = $2 AND g.organization_id = $1
         ${timeFilter}
       ORDER BY s.started_at DESC
       LIMIT $${params.length}`,
      params
    );
    for (const r of rows) {
      const sec = r.duration_ms != null ? Math.round(Number(r.duration_ms) / 1000) : null;
      const dur = sec != null && sec > 0 ? ` ${sec} s` : '';
      events.push({
        id: `ptt:${r.id}`,
        kind: 'radio',
        summary: `Habló${dur} en «${r.group_name || 'canal'}»`,
        meta: {
          sessionId: r.id,
          groupId: r.group_id,
          groupName: r.group_name,
        },
        createdAt: r.started_at,
        source: 'ptt',
      });
    }
  }

  events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return events.slice(0, lim);
}

/**
 * Pares DM con historial para un operador (solo lectura admin).
 */
export async function listAuditDmConversations(orgId, subjectUserId) {
  const { rows: check } = await query(
    `SELECT id FROM users WHERE id = $1 AND organization_id = $2`,
    [subjectUserId, orgId]
  );
  if (!check[0]) return { conversations: [] };

  const { rows } = await query(
    `WITH latest AS (
       SELECT DISTINCT ON (pair)
         id, sender_id, recipient_id, type, body, media_name, created_at, deleted_at,
         CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS peer_id
       FROM (
         SELECT m.*,
           LEAST(m.sender_id::text, m.recipient_id::text) || '_' ||
           GREATEST(m.sender_id::text, m.recipient_id::text) AS pair
         FROM messages m
         JOIN users u ON u.id = CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END
         WHERE m.group_id IS NULL
           AND m.recipient_id IS NOT NULL
           AND (m.sender_id = $1 OR m.recipient_id = $1)
           AND u.organization_id = $2
       ) t
       ORDER BY pair, created_at DESC
     )
     SELECT l.*, u.display_name AS peer_name, u.username AS peer_username,
            u.is_active AS peer_active, u.avatar_url AS peer_avatar_url
     FROM latest l
     JOIN users u ON u.id = l.peer_id
     ORDER BY l.created_at DESC
     LIMIT 100`,
    [subjectUserId, orgId]
  );

  return {
    conversations: rows.map((r) => ({
      peerId: r.peer_id,
      peerName: r.peer_name,
      peerUsername: r.peer_username,
      peerActive: r.peer_active,
      peerAvatarUrl: r.peer_avatar_url
        ? `/api/avatars/file/${encodeURIComponent(r.peer_avatar_url)}`
        : null,
      lastMessage: {
        id: r.id,
        type: r.deleted_at ? 'text' : r.type,
        body: r.deleted_at
          ? null
          : r.type === 'sticker'
            ? null
            : r.type === 'nudge'
              ? '¡Zumbido!'
              : openMessageBody(r.type, r.body),
        mediaName: r.deleted_at ? null : r.media_name,
        createdAt: r.created_at,
        isDeleted: Boolean(r.deleted_at),
        mine: String(r.sender_id) === String(subjectUserId),
      },
    })),
  };
}

/**
 * Notas de voz recientes en la org (una consulta; auditoría admin).
 */
export async function listAuditChatAudio(orgId, { hours = 24, limit = 80 } = {}) {
  const hrs = Math.min(Math.max(Number(hours) || 24, 1), 168);
  const lim = Math.min(Math.max(Number(limit) || 80, 1), 200);

  const { rows } = await query(
    `SELECT m.id, m.group_id, m.sender_id, m.recipient_id, m.type, m.media_mime, m.media_name,
            m.created_at,
            u.display_name AS sender_name,
            g.name AS group_name
     FROM messages m
     INNER JOIN users u ON u.id = m.sender_id AND u.organization_id = $1
     LEFT JOIN groups g ON g.id = m.group_id AND g.organization_id = $1
     WHERE m.type = 'audio'
       AND m.deleted_at IS NULL
       AND m.media_url IS NOT NULL
       AND m.created_at >= NOW() - ($2::double precision * INTERVAL '1 hour')
       AND (
         (m.group_id IS NOT NULL AND g.id IS NOT NULL)
         OR (
           m.group_id IS NULL
           AND m.recipient_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM users ur
             WHERE ur.id = m.recipient_id AND ur.organization_id = $1
           )
         )
       )
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [orgId, String(hrs), lim]
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      type: 'audio',
      mediaUrl: `/api/media/${r.id}`,
      mediaMime: r.media_mime || null,
      mediaName: r.media_name || null,
      displayName: r.sender_name || 'Usuario',
      createdAt: r.created_at,
      context: r.group_id
        ? r.group_name || 'Grupo'
        : 'Chat directo',
      groupId: r.group_id || null,
      senderId: r.sender_id,
    })),
  };
}

/**
 * Hilo DM entre subject y peer (solo lectura admin).
 */
export async function listAuditDmMessages(orgId, subjectUserId, peerId, { limit = 120, aroundId = null } = {}) {
  const { rows: check } = await query(
    `SELECT u1.id AS a, u2.id AS b
     FROM users u1, users u2
     WHERE u1.id = $1 AND u2.id = $2
       AND u1.organization_id = $3 AND u2.organization_id = $3`,
    [subjectUserId, peerId, orgId]
  );
  if (!check[0]) return { peer: null, messages: [] };

  const { rows: peerRows } = await query(
    `SELECT id, display_name, username, avatar_url FROM users WHERE id = $1`,
    [peerId]
  );
  const peer = peerRows[0]
    ? {
        id: peerRows[0].id,
        displayName: peerRows[0].display_name,
        username: peerRows[0].username,
        avatarUrl: peerRows[0].avatar_url
          ? `/api/avatars/file/${encodeURIComponent(peerRows[0].avatar_url)}`
          : null,
      }
    : null;

  const lim = Math.min(Math.max(Number(limit) || 120, 1), 250);
  const { rows } = await query(
    `SELECT m.id, m.sender_id, m.recipient_id, m.type, m.body, m.media_url, m.media_mime,
            m.media_name, m.media_size, m.deleted_at, m.created_at,
            u.display_name AS sender_name
     FROM (
       SELECT id, sender_id, recipient_id, type, body, media_url, media_mime, media_name,
              media_size, deleted_at, created_at
       FROM messages
       WHERE group_id IS NULL AND recipient_id IS NOT NULL
         AND (
           (sender_id = $1 AND recipient_id = $2)
           OR (sender_id = $2 AND recipient_id = $1)
         )
       ORDER BY created_at DESC
       LIMIT $3
     ) m
     LEFT JOIN users u ON u.id = m.sender_id
     ORDER BY m.created_at ASC`,
    [subjectUserId, peerId, lim]
  );

  const messages = rows.map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name || 'Usuario',
    type: r.type,
    body: r.deleted_at ? null : openMessageBody(r.type, r.body),
    mediaUrl: r.deleted_at ? null : r.media_url,
    mediaMime: r.deleted_at ? null : r.media_mime,
    mediaName: r.deleted_at ? null : r.media_name,
    isDeleted: Boolean(r.deleted_at),
    createdAt: r.created_at,
    mine: String(r.sender_id) === String(subjectUserId),
    highlight: aroundId && String(r.id) === String(aroundId),
  }));

  return { peer, messages };
}

/**
 * Mensajes de grupo (solo lectura admin, org).
 */
export async function listAuditGroupMessages(orgId, groupId, { limit = 120, aroundId = null } = {}) {
  const { rows: gRows } = await query(
    `SELECT id, name FROM groups WHERE id = $1 AND organization_id = $2`,
    [groupId, orgId]
  );
  if (!gRows[0]) return { group: null, messages: [] };

  const lim = Math.min(Math.max(Number(limit) || 120, 1), 250);
  const { rows } = await query(
    `SELECT m.id, m.sender_id, m.type, m.body, m.media_url, m.media_mime, m.media_name,
            m.deleted_at, m.created_at, u.display_name AS sender_name
     FROM (
       SELECT id, sender_id, type, body, media_url, media_mime, media_name, deleted_at, created_at
       FROM messages
       WHERE group_id = $1
       ORDER BY created_at DESC
       LIMIT $2
     ) m
     LEFT JOIN users u ON u.id = m.sender_id
     ORDER BY m.created_at ASC`,
    [groupId, lim]
  );

  return {
    group: { id: gRows[0].id, name: gRows[0].name },
    messages: rows.map((r) => ({
      id: r.id,
      senderId: r.sender_id,
      senderName: r.sender_name || 'Usuario',
      type: r.type,
      body: r.deleted_at ? null : openMessageBody(r.type, r.body),
      mediaUrl: r.deleted_at ? null : r.media_url,
      mediaMime: r.deleted_at ? null : r.media_mime,
      mediaName: r.deleted_at ? null : r.media_name,
      isDeleted: Boolean(r.deleted_at),
      createdAt: r.created_at,
      highlight: aroundId && String(r.id) === String(aroundId),
    })),
  };
}
