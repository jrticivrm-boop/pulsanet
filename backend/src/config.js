import 'dotenv/config';
import { APP_VERSION } from './version.js';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const jwtSecret = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion';
const weakSecrets = new Set([
  'dev-secret-cambiar-en-produccion',
  'cambiar-en-produccion-minimo-32-caracteres',
  'cambia-este-jwt-secret-minimo-32-caracteres',
]);

if (isProd) {
  if (!process.env.JWT_SECRET || jwtSecret.length < 32 || weakSecrets.has(jwtSecret)) {
    console.error(
      'FATAL: En production JWT_SECRET debe existir, tener ≥32 caracteres y no ser un valor de ejemplo.'
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL requerido en production.');
    process.exit(1);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  isProd,
  version: APP_VERSION,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:@127.0.0.1:5432/pulsanet_db',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  trustProxy: process.env.TRUST_PROXY === '1' || isProd,
  rateLimitMax: parseInt(
    process.env.RATE_LIMIT_MAX || (isProd ? '300' : '2000'),
    10
  ),
  livekit: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },
  /** AES-256-GCM para cuerpos de chat/DM en reposo */
  contentEncryptionKey: process.env.CONTENT_ENCRYPTION_KEY || '',
  /** Secreto HMAC para E2EE de voz LiveKit por room */
  livekitE2eeSecret: process.env.LIVEKIT_E2EE_SECRET || '',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  },
};
