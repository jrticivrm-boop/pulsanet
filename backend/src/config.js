import 'dotenv/config';
import { APP_VERSION } from './version.js';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
/** Dominio publico (DuckDNS/Caddy): exige mismos secretos fuertes que production. */
const publicExposed = Boolean(String(process.env.PUBLIC_DOMAIN || '').trim());

const jwtSecret = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion';
const weakSecrets = new Set([
  'dev-secret-cambiar-en-produccion',
  'cambiar-en-produccion-minimo-32-caracteres',
  'cambia-este-jwt-secret-minimo-32-caracteres',
  'cambiar-content-aes-minimo-32-caracteres',
  'cambiar-wire-aes-minimo-32-caracteres',
  'cambiar-livekit-e2ee-minimo-32-caracteres',
  'cambiar-app-update-secret-minimo-32-caracteres',
  'cambia-este-secreto-desbloqueo-minimo-16',
]);

function assertProdSecret(name, value) {
  const v = String(value || '').trim();
  if (!v || v.length < 32 || weakSecrets.has(v)) {
    console.error(
      `FATAL: En production ${name} debe existir, tener ≥32 caracteres y no ser un valor de ejemplo.`
    );
    process.exit(1);
  }
}

function assertUnlockSecret(value) {
  const v = String(value || '').trim();
  if (!v || v.length < 16 || weakSecrets.has(v)) {
    console.error(
      'FATAL: LOCKDOWN_UNLOCK_SECRET debe existir (≥16), no ser el valor de ejemplo del .env.example.'
    );
    process.exit(1);
  }
}

if (publicExposed && !isProd) {
  console.error(
    'FATAL: PUBLIC_DOMAIN está definido pero NODE_ENV≠production. ' +
      'El borde público exige production (secretos fuertes). ' +
      'Pon NODE_ENV=production en backend/.env'
  );
  process.exit(1);
}

if (isProd) {
  assertProdSecret('JWT_SECRET', jwtSecret);
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL requerido en production.');
    process.exit(1);
  }
}

const tlsCertPath = (process.env.TLS_CERT || process.env.TLS_CERT_PATH || '').trim();
const tlsKeyPath = (process.env.TLS_KEY || process.env.TLS_KEY_PATH || '').trim();
const tlsEnabled = Boolean(tlsCertPath && tlsKeyPath);

if (isProd) {
  assertProdSecret('CONTENT_ENCRYPTION_KEY', process.env.CONTENT_ENCRYPTION_KEY);
  assertProdSecret('LIVEKIT_E2EE_SECRET', process.env.LIVEKIT_E2EE_SECRET);
  assertProdSecret('WIRE_ENCRYPTION_KEY', process.env.WIRE_ENCRYPTION_KEY);
  assertProdSecret('APP_UPDATE_SECRET', process.env.APP_UPDATE_SECRET);
  if (String(process.env.ALLOW_HOST_LOCKDOWN || '').trim() === '1') {
    assertUnlockSecret(process.env.LOCKDOWN_UNLOCK_SECRET);
  }
}

/** Consola web pública (redirect GET /). Preferir WEB_PUBLIC_URL; si no, primer CORS público; fallback PUBLIC_HOST. */
function resolveWebPublicUrl() {
  const fromEnv = (process.env.WEB_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const origins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isPrivate = (o) =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(o) ||
    /^https?:\/\/192\.168\./i.test(o) ||
    /^https?:\/\/10\./i.test(o) ||
    /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\./i.test(o);
  const publicish = origins.find((o) => !isPrivate(o));
  if (publicish) return publicish.replace(/\/$/, '');
  const host = (process.env.PUBLIC_HOST || process.env.LIVEKIT_PUBLIC_HOST || '').trim();
  if (host) {
    const h = host.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
    return `https://${h}:5173`;
  }
  return 'https://127.0.0.1:5173';
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  isProd,
  version: APP_VERSION,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:@127.0.0.1:5432/tacticalptx_db',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  /**
   * URL pública de la consola web (Vite :5173).
   * GET / de la API redirige aquí. Override: WEB_PUBLIC_URL.
   */
  webPublicUrl: resolveWebPublicUrl(),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  trustProxy:
    process.env.TRUST_PROXY === '0'
      ? false
      : process.env.TRUST_PROXY === '1' ||
        isProd ||
        Boolean(String(process.env.PUBLIC_DOMAIN || '').trim()),
  rateLimitMax: parseInt(
    // Consola: locations ~cada 5 s + overview 15 s + track → >300/15min por sesión.
    process.env.RATE_LIMIT_MAX || (isProd ? '2000' : '2000'),
    10
  ),
  /**
   * Interfaz de listen HTTP(S).
   * Con dominio publico / production: solo loopback (Caddy hace de edge).
   * Dev LAN: LISTEN_HOST=0.0.0.0 + TPX_FW_DEV=1.
   * Forzar all-interfaces con edge público: TPX_LISTEN_UNSAFE=1 (no recomendado).
   */
  listenHost: (() => {
    const raw = String(process.env.LISTEN_HOST || '').trim();
    const locked = isProd || publicExposed;
    const unsafe = process.env.TPX_LISTEN_UNSAFE === '1';
    if (locked && !unsafe) {
      if (raw && raw !== '127.0.0.1' && raw !== '::1') {
        console.warn(
          `[config] LISTEN_HOST=${raw} ignorado con production/PUBLIC_DOMAIN; usando 127.0.0.1 (TPX_LISTEN_UNSAFE=1 para anular).`
        );
      }
      return '127.0.0.1';
    }
    if (raw) return raw;
    if (locked) return '127.0.0.1';
    return '0.0.0.0';
  })(),
  /** Secreto OTA APK (header X-App-Update-Key). Obligatorio en production. */
  appUpdateSecret: (process.env.APP_UPDATE_SECRET || '').trim(),
  livekit: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },
  /** AES-256-GCM para cuerpos de chat/DM en reposo */
  contentEncryptionKey: process.env.CONTENT_ENCRYPTION_KEY || '',
  /** Secreto HMAC para E2EE de voz LiveKit por room */
  livekitE2eeSecret: process.env.LIVEKIT_E2EE_SECRET || '',
  /** HTTPS entre hosts (certificado PEM) */
  tls: {
    enabled: tlsEnabled,
    certPath: tlsCertPath,
    keyPath: tlsKeyPath,
  },
  /**
   * Cifrado AES de eventos socket sensibles (GPS).
   * Activo con WIRE_ENCRYPTION=1 o WIRE_ENCRYPTION_KEY (obligatorio en production).
   */
  wireEncryption:
    process.env.WIRE_ENCRYPTION === '0'
      ? false
      : process.env.WIRE_ENCRYPTION === '1' ||
        Boolean(process.env.WIRE_ENCRYPTION_KEY?.trim()),
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  },
};
