import fs from 'fs';
import admin from 'firebase-admin';
import { query } from '../db.js';
import { config } from '../config.js';

let ready = false;

/**
 * Canal nativo de mensajes: Android lo muestra aunque la app duerma, con el tono,
 * vibración, silencio y No molestar que el usuario tenga en el teléfono.
 * La app crea el canal con el mismo id (sin tono propio).
 */
export const MSG_CHANNEL_ID = 'sicom_mensajes_v1';

function nativeMessagePayload({ title, body, tag, data }) {
  return {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries({ ...data, title, body }).map(([k, v]) => [k, String(v ?? '')])
    ),
    android: {
      priority: 'high',
      notification: {
        channelId: MSG_CHANNEL_ID,
        ...(tag ? { tag } : {}),
        icon: 'ic_stat_sicom',
        color: '#1E88E5',
        defaultSound: true,
        defaultVibrateTimings: true,
        notificationPriority: 'PRIORITY_HIGH',
        visibility: 'private',
      },
    },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          ...(tag ? { 'thread-id': tag } : {}),
          interruptionLevel: 'time-sensitive',
        },
      },
    },
  };
}

export function isFcmReady() {
  return ready;
}

export function initFcm() {
  if (ready || admin.apps.length) {
    ready = Boolean(admin.apps.length);
    return ready;
  }

  try {
    if (config.firebase.serviceAccountPath && fs.existsSync(config.firebase.serviceAccountPath)) {
      const json = JSON.parse(fs.readFileSync(config.firebase.serviceAccountPath, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(json) });
      ready = true;
      console.log('FCM: listo (service account file)');
      return true;
    }

    const { projectId, clientEmail, privateKey } = config.firebase;
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      ready = true;
      console.log('FCM: listo (env credentials)');
      return true;
    }

    console.log('FCM: no configurado (devices se registran; no se envían pushes)');
    return false;
  } catch (err) {
    console.error('FCM init error:', err.message);
    ready = false;
    return false;
  }
}

/**
 * Notifica a miembros del grupo excepto excludeUserId.
 */
export async function notifyGroupMembers({
  groupId,
  excludeUserId,
  title,
  body,
  data = {},
}) {
  if (!ready) return { sent: 0, skipped: true };

  const { rows } = await query(
    `SELECT d.fcm_token
     FROM devices d
     INNER JOIN group_members gm ON gm.user_id = d.user_id
     WHERE gm.group_id = $1
       AND d.is_active = TRUE
       AND d.fcm_token IS NOT NULL
       AND ($2::uuid IS NULL OR d.user_id <> $2)`,
    [groupId, excludeUserId || null]
  );

  const tokens = [...new Set(rows.map((r) => r.fcm_token).filter(Boolean))];
  if (!tokens.length) return { sent: 0 };

  let groupName = data.groupName || '';
  if (!groupName) {
    try {
      const g = await query(`SELECT name FROM groups WHERE id = $1`, [groupId]);
      groupName = g.rows[0]?.name || '';
    } catch {
      /* sin nombre: la app muestra «Canal» */
    }
  }

  const payload = nativeMessagePayload({
    title: groupName ? `${title} · ${groupName}` : title,
    body,
    tag: `g:${groupId}`,
    data: {
      ...data,
      groupId,
      groupName,
      senderId: excludeUserId || '',
      senderName: title,
    },
  });

  let sent = 0;
  // FCM multicast en lotes de 500
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        ...payload,
      });
      sent += res.successCount;
      if (res.failureCount) {
        const bad = [];
        res.responses.forEach((r, idx) => {
          if (!r.success) {
            const code = r.error?.code || '';
            if (
              code.includes('registration-token-not-registered') ||
              code.includes('invalid-registration-token')
            ) {
              bad.push(batch[idx]);
            }
          }
        });
        if (bad.length) {
          await query(
            `UPDATE devices SET is_active = FALSE WHERE fcm_token = ANY($1::text[])`,
            [bad]
          );
        }
      }
    } catch (err) {
      console.error('FCM send:', err.message);
    }
  }
  return { sent };
}

/**
 * Push de alerta (mismo canal/sonido que notifyGroupMembers) a una lista de usuarios.
 * `collapse` agrupa notificaciones del mismo evento en el dispositivo.
 */
export async function notifyUserIdsAlert({ userIds, title, body, data = {}, collapse }) {
  if (!ready) return { sent: 0, skipped: true };
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return { sent: 0 };

  const { rows } = await query(
    `SELECT fcm_token FROM devices
     WHERE user_id = ANY($1::uuid[]) AND is_active = TRUE AND fcm_token IS NOT NULL`,
    [ids]
  );
  const tokens = [...new Set(rows.map((r) => r.fcm_token).filter(Boolean))];
  if (!tokens.length) return { sent: 0 };

  const tag = collapse || `alert:${data?.panicId || Date.now()}`;
  // Android: solo datos → la app muestra la alerta en rojo, fija hasta atenderla.
  const payload = {
    data: Object.fromEntries(
      Object.entries({ ...data, title, body }).map(([k, v]) => [k, String(v ?? '')])
    ),
    android: {
      priority: 'high',
      collapseKey: tag,
    },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: 'tactical_msg.wav',
          interruptionLevel: 'time-sensitive',
        },
      },
    },
  };

  let sent = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const res = await admin.messaging().sendEachForMulticast({ tokens: batch, ...payload });
      sent += res.successCount;
      if (res.failureCount) {
        const bad = [];
        res.responses.forEach((r, idx) => {
          const code = r.success ? '' : r.error?.code || '';
          if (
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-registration-token')
          ) {
            bad.push(batch[idx]);
          }
        });
        if (bad.length) {
          await query(
            `UPDATE devices SET is_active = FALSE WHERE fcm_token = ANY($1::text[])`,
            [bad]
          );
        }
      }
    } catch (err) {
      console.error('FCM alert send:', err.message);
    }
  }
  return { sent };
}

async function sendToTokens(tokens, payload, label) {
  let sent = 0;
  try {
    const res = await admin.messaging().sendEachForMulticast({ tokens, ...payload });
    sent = res.successCount;
    const bad = [];
    res.responses.forEach((r, idx) => {
      const code = r.success ? '' : r.error?.code || '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token')
      ) {
        bad.push(tokens[idx]);
      }
    });
    if (bad.length) {
      await query(`UPDATE devices SET is_active = FALSE WHERE fcm_token = ANY($1::text[])`, [bad]);
    }
  } catch (err) {
    console.error(`${label}:`, err.message);
    return { sent: 0, error: err.message };
  }
  return { sent };
}

/**
 * Envía push a todos los dispositivos activos de un usuario.
 */
export async function notifyUserDevices({ userId, title, body, data = {} }) {
  if (!ready) return { sent: 0, skipped: true };

  const { rows } = await query(
    `SELECT fcm_token FROM devices
     WHERE user_id = $1 AND is_active = TRUE AND fcm_token IS NOT NULL`,
    [userId]
  );
  const tokens = [...new Set(rows.map((r) => r.fcm_token).filter(Boolean))];
  if (!tokens.length) return { sent: 0, error: 'Sin dispositivos registrados' };

  const isCallPush =
    data?.type === 'private_call' ||
    data?.type === 'private_radio' ||
    data?.type === 'private_video' ||
    data?.type === 'private_call_invite' ||
    data?.type === 'private_video_invite' ||
    data?.type === 'group_video';

  const notifTag =
    data?.type === 'group_video' && data?.groupId
      ? `gvideo:${data.groupId}`
      : (data?.type === 'dm' || data?.type === 'dm_nudge') && data?.peerId
        ? `dm:${data.peerId}`
        : isCallPush
          ? `call:${data.callId || data.peerId || userId}`
          : data?.groupId
            ? `g:${data.groupId}`
            : undefined;

  const isNudge = data?.type === 'dm_nudge';
  const isAnnouncement = data?.type === 'announcement';
  const androidSound = isCallPush
    ? 'default'
    : isNudge
      ? 'nudge_buzz'
      : isAnnouncement
        ? 'default'
        : 'tactical_msg';
  const iosSound = isCallPush
    ? 'default'
    : isNudge
      ? 'nudge_buzz.wav'
      : 'tactical_msg.wav';
  const channelId = isCallPush
    ? 'tacticalptx_calls_v3'
    : isNudge
      ? 'tacticalptx_nudge_v2'
      : isAnnouncement
        ? 'tacticalptx_announcements_v1'
        : 'tacticalptx_alerts_v3';

  if (data?.type === 'dm' || data?.type === 'dm_nudge') {
    return sendToTokens(
      tokens,
      nativeMessagePayload({ title, body, tag: notifTag, data }),
      'FCM notifyUser'
    );
  }

  // Llamadas perdidas y avisos: solo datos en Android (la app arma la notificación).
  const richType = ['missed_call', 'announcement'].includes(data?.type);
  if (richType) {
    const richPayload = {
      data: Object.fromEntries(
        Object.entries({ ...data, title, body }).map(([k, v]) => [k, String(v ?? '')])
      ),
      android: {
        priority: 'high',
        ...(isAnnouncement ? { collapseKey: `ann:${data.announcementId || 'x'}` } : {}),
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: iosSound,
            interruptionLevel: 'time-sensitive',
          },
        },
      },
    };
    return sendToTokens(tokens, richPayload, 'FCM notifyUser');
  }

  const payload = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries({ ...data, title, body }).map(([k, v]) => [
        k,
        String(v ?? ''),
      ])
    ),
    android: {
      priority: 'high',
      ...(notifTag ? { collapseKey: notifTag } : {}),
      ...(isAnnouncement ? { collapseKey: `ann:${data.announcementId || 'x'}` } : {}),
      notification: {
        channelId,
        sound: androidSound,
        ...(notifTag ? { tag: notifTag } : {}),
        ...(isAnnouncement && data.announcementId
          ? { tag: `ann:${data.announcementId}` }
          : {}),
        priority: 'max',
        visibility: isAnnouncement ? 'public' : 'private',
        defaultVibrateTimings: true,
        ...(isCallPush
          ? {
              defaultSound: true,
            }
          : {}),
      },
    },
    apns: {
      payload: {
        aps: {
          sound: iosSound,
          interruptionLevel: 'time-sensitive',
        },
      },
    },
  };

  let sent = 0;
  try {
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      ...payload,
    });
    sent = res.successCount;
    const bad = [];
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token')
        ) {
          bad.push(tokens[idx]);
        }
      }
    });
    if (bad.length) {
      await query(
        `UPDATE devices SET is_active = FALSE WHERE fcm_token = ANY($1::text[])`,
        [bad]
      );
    }
  } catch (err) {
    console.error('FCM notifyUser:', err.message);
    return { sent: 0, error: err.message };
  }
  return { sent };
}

/**
 * Data-only (sin notification): el cliente muestra FSI / Contestar.
 * Con payload `notification` Android solo pone heads-up y no corre el handler.
 */
export async function notifyUserDevicesDataOnly({ userId, data = {} }) {
  if (!ready) return { sent: 0, skipped: true };

  const { rows } = await query(
    `SELECT fcm_token FROM devices
     WHERE user_id = $1 AND is_active = TRUE AND fcm_token IS NOT NULL`,
    [userId]
  );
  const tokens = [...new Set(rows.map((r) => r.fcm_token).filter(Boolean))];
  if (!tokens.length) return { sent: 0, error: 'Sin dispositivos registrados' };

  const payload = {
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v ?? '')])
    ),
    android: {
      priority: 'high',
      // ~2 min: tiempo de ring Contestar
      ttl: 120000,
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'background',
      },
      payload: {
        aps: {
          'content-available': 1,
        },
      },
    },
  };

  let sent = 0;
  try {
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      ...payload,
    });
    sent = res.successCount;
  } catch (err) {
    console.error('FCM data-only:', err.message);
    return { sent: 0, error: err.message };
  }
  return { sent };
}

/**
 * PTT en un canal: despierta el radio de miembros sin socket vivo (app dormida/cerrada).
 * Data-only con TTL corto: un aviso viejo ya no sirve para escuchar en vivo.
 */
export async function notifyPttWake({ groupId, groupName, speakerId, speakerName, userIds }) {
  if (!ready) return { sent: 0, skipped: true };
  const ids = [...new Set((userIds || []).map(String))];
  if (!ids.length) return { sent: 0 };

  const { rows } = await query(
    `SELECT fcm_token FROM devices
     WHERE user_id = ANY($1::uuid[]) AND is_active = TRUE AND fcm_token IS NOT NULL`,
    [ids]
  );
  const tokens = [...new Set(rows.map((r) => r.fcm_token).filter(Boolean))];
  if (!tokens.length) return { sent: 0 };

  const data = {
    type: 'ptt_wake',
    groupId,
    groupName: groupName || 'Canal',
    speakerId: speakerId || '',
    speakerName: speakerName || 'Operador',
    at: Date.now(),
  };
  const payload = {
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])),
    android: {
      priority: 'high',
      collapseKey: `ptt:${groupId}`,
      ttl: 20000,
    },
    apns: {
      headers: { 'apns-priority': '10', 'apns-push-type': 'background' },
      payload: { aps: { 'content-available': 1 } },
    },
  };

  let sent = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const res = await admin.messaging().sendEachForMulticast({ tokens: batch, ...payload });
      sent += res.successCount;
    } catch (err) {
      console.error('FCM ptt wake:', err.message);
    }
  }
  return { sent };
}

/**
 * Invita a miembros del grupo a una transmisión en vivo (canal de llamadas).
 */
export async function notifyGroupVideoInvite({
  groupId,
  groupName,
  startedBy,
  startedByName,
  excludeUserId,
}) {
  if (!ready) return { sent: 0, skipped: true };

  const { rows } = await query(
    `SELECT d.fcm_token
     FROM devices d
     INNER JOIN group_members gm ON gm.user_id = d.user_id
     WHERE gm.group_id = $1
       AND d.is_active = TRUE
       AND d.fcm_token IS NOT NULL
       AND ($2::uuid IS NULL OR d.user_id <> $2)`,
    [groupId, excludeUserId || null]
  );

  const tokens = [...new Set(rows.map((r) => r.fcm_token).filter(Boolean))];
  if (!tokens.length) return { sent: 0 };

  const title = 'Transmisión grupal en vivo';
  const body = `${startedByName || 'Un operador'} inició video en «${groupName || 'grupo'}»`;
  const data = {
    type: 'group_video',
    groupId,
    groupName: groupName || 'Grupo',
    startedBy: startedBy || '',
    startedByName: startedByName || 'Operador',
    title,
    body,
  };

  const payload = {
    data: Object.fromEntries(
      Object.entries({ ...data, title, body }).map(([k, v]) => [k, String(v ?? '')])
    ),
    android: {
      priority: 'high',
      collapseKey: `gvideo:${groupId}`,
      ttl: 120000,
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'background',
      },
      payload: {
        aps: {
          'content-available': 1,
        },
      },
    },
  };

  let sent = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        ...payload,
      });
      sent += res.successCount;
      if (res.failureCount) {
        const bad = [];
        res.responses.forEach((r, idx) => {
          if (!r.success) {
            const code = r.error?.code || '';
            if (
              code.includes('registration-token-not-registered') ||
              code.includes('invalid-registration-token')
            ) {
              bad.push(batch[idx]);
            }
          }
        });
        if (bad.length) {
          await query(
            `UPDATE devices SET is_active = FALSE WHERE fcm_token = ANY($1::text[])`,
            [bad]
          );
        }
      }
    } catch (err) {
      console.error('FCM group video:', err.message);
    }
  }
  return { sent };
}
