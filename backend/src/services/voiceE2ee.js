import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Clave compartida por room LiveKit (PTT / llamada).
 * Los clientes la usan con ExternalE2EEKeyProvider / BaseKeyProvider.
 * WebRTC ya lleva DTLS-SRTP; esto añade cifrado de aplicación encima del SFU.
 *
 * v3: room incluye callId → clave distinta por sesión (mejor integridad).
 */
function resolveVoiceSecret() {
  const fromEnv = process.env.LIVEKIT_E2EE_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  return `tacticalptx-voice|${config.livekit.apiSecret || 'dev'}|${config.jwtSecret}`;
}

export function isVoiceE2eeReady() {
  if (config.isProd) {
    return Boolean(process.env.LIVEKIT_E2EE_SECRET?.trim()?.length >= 32);
  }
  // Dev: requiere secreto dedicado o al menos API secret LiveKit (nunca "siempre true").
  const dedicated = process.env.LIVEKIT_E2EE_SECRET?.trim();
  if (dedicated && dedicated.length >= 16) return true;
  return Boolean(config.livekit.apiSecret && String(config.livekit.apiSecret).length >= 4);
}

/** Clave base64url estable por room (32 bytes) vía HMAC-SHA256. */
export function voiceE2eeKeyForRoom(roomName) {
  if (!roomName || !isVoiceE2eeReady()) return null;
  if (config.isProd && !process.env.LIVEKIT_E2EE_SECRET?.trim()) return null;
  return crypto
    .createHmac('sha256', resolveVoiceSecret())
    .update(`lk-e2ee-v3:${String(roomName)}`)
    .digest('base64url');
}
