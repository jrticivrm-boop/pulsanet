import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Clave compartida por room LiveKit (PTT / llamada).
 * Los clientes la usan con ExternalE2EEKeyProvider / BaseKeyProvider.
 * WebRTC ya lleva DTLS-SRTP; esto añade cifrado de aplicación encima del SFU.
 */
function resolveVoiceSecret() {
  const fromEnv = process.env.LIVEKIT_E2EE_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  return `tacticalptx-voice|${config.livekit.apiSecret || 'dev'}|${config.jwtSecret}`;
}

export function isVoiceE2eeReady() {
  return Boolean(
    process.env.LIVEKIT_E2EE_SECRET?.trim() ||
      config.livekit.apiSecret ||
      !config.isProd
  );
}

/** Clave base64url estable por room (32 bytes). */
export function voiceE2eeKeyForRoom(roomName) {
  if (!roomName || !isVoiceE2eeReady()) return null;
  return crypto
    .createHmac('sha256', resolveVoiceSecret())
    .update(`lk-e2ee-v1:${String(roomName)}`)
    .digest('base64url');
}
