import fs from 'fs';
import admin from 'firebase-admin';
import { query } from '../db.js';
import { config } from '../config.js';

let ready = false;

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

  const payload = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries({ ...data, groupId }).map(([k, v]) => [k, String(v ?? '')])
    ),
    android: {
      priority: 'high',
      notification: { channelId: 'tacticalptx_alerts', sound: 'default' },
    },
  };

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

  const payload = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v ?? '')])
    ),
    android: {
      priority: 'high',
      notification: {
        channelId:
          data?.type === 'private_call' ? 'tacticalptx_calls' : 'tacticalptx_alerts',
        sound: 'default',
        ...(data?.type === 'private_call'
          ? { priority: 'max', defaultSound: true, defaultVibrateTimings: true }
          : {}),
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          ...(data?.type === 'private_call' ? { interruptionLevel: 'time-sensitive' } : {}),
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
