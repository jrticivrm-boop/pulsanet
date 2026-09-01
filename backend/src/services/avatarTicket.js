import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config.js';

const TTL_SEC = 3600; // 1 h — suficiente para <img> / NetworkImage sin exponer el JWT

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payloadB64) {
  return b64url(createHmac('sha256', config.jwtSecret).update(`avt.v1.${payloadB64}`).digest());
}

/**
 * Ticket corto para GET /api/avatars/* en query (?atk=).
 * No es el access JWT: no sirve para API ni sockets.
 */
export function mintAvatarTicket(user, ttlSec = TTL_SEC) {
  const sub = user?.sub || user?.id;
  const orgId = user?.orgId || user?.organization_id || user?.organizationId;
  if (!sub || !orgId) throw new Error('avatar ticket: usuario incompleto');
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payloadB64 = b64url(JSON.stringify({ sub, orgId, exp }));
  const sig = sign(payloadB64);
  return { ticket: `v1.${payloadB64}.${sig}`, expiresIn: ttlSec, exp };
}

/**
 * @returns {{ sub: string, orgId: string, exp: number } | null}
 */
export function verifyAvatarTicket(ticket) {
  if (!ticket || typeof ticket !== 'string') return null;
  const parts = ticket.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [, payloadB64, sig] = parts;
  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let data;
  try {
    data = JSON.parse(fromB64url(payloadB64).toString('utf8'));
  } catch {
    return null;
  }
  if (!data?.sub || !data?.orgId || !data?.exp) return null;
  if (Number(data.exp) < Math.floor(Date.now() / 1000)) return null;
  return { sub: String(data.sub), orgId: String(data.orgId), exp: Number(data.exp) };
}
