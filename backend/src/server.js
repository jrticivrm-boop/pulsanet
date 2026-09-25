/**
 * SICOM API — punto de entrada HTTP + Socket.IO
 *
 * Secciones:
 *  - Config / TLS / Express (helmet, CORS, rate-limit, lockdown)
 *  - Rutas REST (/api/*): auth, grupos, chat, llamadas, GPS, admin, OTA…
 *  - Socket.IO: PTT, chat, DM, despacho, política de sesión
 *  - Arranque: Redis, FCM, LiveKit, respaldos programados
 */
import http from 'http';
import https from 'https';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { wrapRouterAsync } from './middleware/asyncRouter.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { groupsRouter } from './routes/groups.js';
import { livekitRouter } from './routes/livekit.js';
import { createMessagesRouter, createMediaRouter } from './routes/messages.js';
import { adminRouter } from './routes/admin.js';
import { createLocationsRouter } from './routes/locations.js';
import { profilesRouter } from './routes/profiles.js';
import { geofencesRouter } from './routes/geofences.js';
import { tacticalSitesRouter } from './routes/tacticalSites.js';
import { createRecordingsRouter } from './routes/recordings.js';
import { createMetricsRouter } from './routes/metrics.js';
import { devicesRouter } from './routes/devices.js';
import { stickersRouter } from './routes/stickers.js';
import { createPanicRouter } from './routes/panic.js';
import { createAnnouncementsRouter } from './routes/announcements.js';
import { securityRouter } from './routes/security.js';
import { lockdownGuard, bindIntrusionIo, isLockdownActive } from './services/intrusion.js';
import { registerPttHandlers } from './socket/ptt.js';
import { registerChatHandlers } from './socket/chat.js';
import { registerDispatchHandlers } from './socket/dispatch.js';
import { registerDmHandlers } from './socket/dm.js';
import { createDmRouter } from './routes/dm.js';
import { createCallsRouter, startPrivateCallSweeper } from './routes/calls.js';
import { createGroupVideoRouter } from './routes/groupVideo.js';
import { createMeRouter, createAvatarsRouter } from './routes/me.js';
import { createAppUpdateRouter } from './routes/appUpdate.js';
import { catalogsRouter } from './routes/catalogs.js';
import { backupsRouter } from './routes/backups.js';
import { createPresenceRouter } from './routes/presence.js';
import { isLiveKitConfigured } from './services/livekit.js';
import { startBackupScheduler } from './services/backup.js';
import { bindSessionIo, normalizeDeviceId } from './services/sessionPolicy.js';

import { connectRedis, isRedisReady } from './redis.js';
import { inc } from './services/metrics.js';
import { initFcm, isFcmReady } from './services/fcm.js';
import { loadTlsOptions } from './tls.js';
import { bindLiveUser } from './services/userProfile.js';
import { isWireEncryptionEnabled } from './services/wireCrypto.js';
import { isContentEncryptionReady } from './services/contentCrypto.js';
import { isVoiceE2eeReady } from './services/voiceE2ee.js';

// --- HTTP(S) + Express ---
const app = express();
const tlsOptions = loadTlsOptions();
const server = tlsOptions
  ? https.createServer(tlsOptions, app)
  : http.createServer(app);

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: config.corsOrigins, credentials: true },
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  maxHttpBufferSize: 1e6,
  pingTimeout: 20000,
  pingInterval: 10000,
});

app.use(
  helmet({
    hsts: tlsOptions
      ? { maxAge: 15552000, includeSubDomains: false, preload: false }
      : false,
  })
);
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    /**
     * Por IP, todo el NAT (consola + flota APK) compartía un cupo → 429 en mapa.
     * Con Bearer: clave = cola de la firma JWT (últimos ~32). El header JWT es
     * idéntico en todos los tokens (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.); un
     * slice(0,48) del Authorization colapsaba casi todas las sesiones en un bucket.
     */
    keyGenerator: (req) => {
      const auth = String(req.headers.authorization || '');
      const m = auth.match(/^Bearer\s+(\S+)/i);
      if (m && m[1].length > 20) {
        return `b:${m[1].slice(-32)}`;
      }
      return req.ip || req.socket?.remoteAddress || 'unknown';
    },
    // Custom key (JWT suffix); no usar validación de fallback IP por defecto.
    validate: { keyGeneratorIpFallback: false },
    // Salud y OTA tienen su propio control; no gastar el cupo global (NAT).
    skip: (req) => {
      const p = req.path || '';
      // Salud/OTA: cupo propio. GPS poll (auth en la ruta): no gastar el global.
      if (
        p === '/api/health' ||
        p.startsWith('/api/health/') ||
        p === '/api/app' ||
        p.startsWith('/api/app/')
      ) {
        return true;
      }
      if (req.method !== 'GET') return false;
      if (
        p === '/api/locations' ||
        p.startsWith('/api/locations/') ||
        p === '/api/admin/overview'
      ) {
        return true;
      }
      // RESERVADO (grabaciones + conversaciones): lecturas admin en 1–3 requests, no ráfagas.
      if (p === '/api/recordings' || p.startsWith('/api/recordings/')) return true;
      if (p === '/api/admin/chat-audio') return true;
      if (p === '/api/admin/users') return true;
      if (/^\/api\/admin\/users\/[^/]+\/(groups|dm\/conversations)$/.test(p)) return true;
      return false;
    },
  })
);
app.use(lockdownGuard);

/** Raíz API → consola web (evita JSON "Ruta no encontrada" al abrir :4000 en el móvil). */
app.get('/', (_req, res) => {
  const dest = config.webPublicUrl || 'https://127.0.0.1:5173';
  res.redirect(302, dest);
});

const messagesRouter = wrapRouterAsync(createMessagesRouter(io));
const metricsRouter = wrapRouterAsync(createMetricsRouter(io));
const locationsRouter = wrapRouterAsync(createLocationsRouter(io));
const recordingsRouter = createRecordingsRouter(io);
const mediaRouter = wrapRouterAsync(createMediaRouter());
const dmRouter = wrapRouterAsync(createDmRouter(io));
const callsRouter = wrapRouterAsync(createCallsRouter(io));
const groupVideoRouter = wrapRouterAsync(createGroupVideoRouter(io));

app.use('/api/health', wrapRouterAsync(healthRouter));
app.use('/api/app', wrapRouterAsync(createAppUpdateRouter()));
app.use('/api/security', wrapRouterAsync(securityRouter));

app.use('/api/metrics', metricsRouter);
app.use('/api/auth', wrapRouterAsync(authRouter));
app.use('/api/me', wrapRouterAsync(createMeRouter()));
app.use('/api/avatars', wrapRouterAsync(createAvatarsRouter()));
app.use('/api/groups', wrapRouterAsync(groupsRouter));
app.use('/api/groups/:id/messages', messagesRouter);
app.use('/api/dm', dmRouter);
app.use('/api/calls', callsRouter);
app.use('/api/group-video', groupVideoRouter);
app.use('/api/media', mediaRouter);
app.use('/api/livekit', wrapRouterAsync(livekitRouter));
app.use('/api/admin/profiles', wrapRouterAsync(profilesRouter));
app.use('/api/admin', wrapRouterAsync(adminRouter));
app.use('/api/catalogs', wrapRouterAsync(catalogsRouter));
app.use('/api/backups', wrapRouterAsync(backupsRouter));
app.use('/api/locations', locationsRouter);
app.use('/api/presence', wrapRouterAsync(createPresenceRouter(io)));
app.use('/api/geofences', wrapRouterAsync(geofencesRouter));
app.use('/api/tactical-sites', wrapRouterAsync(tacticalSitesRouter));
app.use('/api/recordings', recordingsRouter);
app.use('/api/devices', wrapRouterAsync(devicesRouter));
app.use('/api/stickers', wrapRouterAsync(stickersRouter));
app.use('/api/panic', wrapRouterAsync(createPanicRouter(io)));
app.use('/api/announcements', wrapRouterAsync(createAnnouncementsRouter(io)));

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No autorizado'));
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return next(new Error('Token inválido'));
  }
  isLockdownActive()
    .then((locked) => {
      if (locked) {
        next(new Error('Servicio bloqueado por seguridad'));
        return null;
      }
      return bindLiveUser(payload);
    })
    .then((user) => {
      if (user === null) return;
      if (!user) return next(new Error('No autorizado'));
      socket.data.user = {
        sub: user.sub,
        role: user.role,
        displayName: user.displayName || 'Usuario',
        orgId: user.orgId,
      };
      socket.data.deviceId = normalizeDeviceId(socket.handshake.auth?.deviceId);
      next();
    })
    .catch((err) => {
      console.error('socket auth profile:', err.message);
      next(new Error('No autorizado'));
    });
});

io.on('connection', (socket) => {
  inc('socketConnects');
  const user = socket.data.user;
  if (user?.sub) {
    socket.join(`user:${user.sub}`);
  }
  // Avisos de abuso de login (admin / despacho)
  if (user?.role && (user.role === 'root' || user.role === 'admin' || user.role === 'zone_admin' || user.role === 'unit_admin' || user.role === 'dispatcher')) {
    socket.join('security:alerts');
  }
  socket.on('disconnect', () => inc('socketDisconnects'));
});

registerPttHandlers(io);
registerChatHandlers(io);
registerDispatchHandlers(io);
registerDmHandlers(io);

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

app.use((err, req, res, _next) => {
  console.error('API error:', req.method, req.originalUrl || req.url, err?.message || err);
  if (res.headersSent) return;
  const msg = config.isProd ? 'Error interno' : (err?.message || 'Error interno');
  res.status(err.status || 500).json({ ok: false, error: msg });
});

async function start() {
  try {
    await connectRedis();
    console.log(`Redis → ${config.redisUrl}`);
  } catch (err) {
    console.error('Redis no disponible:', err.message);
    console.error('Arranca Redis (Laragon) antes de usar presencia/PTT floor.');
    process.exit(1);
  }

  const scheme = tlsOptions ? 'https' : 'http';
  bindIntrusionIo(io);
  bindSessionIo(io);
  // Bind: production/publico → 127.0.0.1 (Caddy upstream). Dev: 0.0.0.0 o LISTEN_HOST.
  const listenHost = config.listenHost || '127.0.0.1';
  server.listen(config.port, listenHost, () => {
    console.log(
      `SICOM API v${config.version} [${config.nodeEnv}] → ${scheme}://${listenHost}:${config.port}`
    );
    console.log(`  Health: GET /api/health`);
    console.log(`  Root →  ${config.webPublicUrl}`);
    console.log(`  Login:  POST /api/auth/login`);
    console.log(`  Redis:  ${isRedisReady() ? 'ok' : 'fail'}`);
    console.log(`  LiveKit: ${isLiveKitConfigured() ? config.livekit.url : 'NO CONFIGURADO'}`);
    console.log(`  FCM:    ${isFcmReady() ? 'ok' : 'off'}`);
    console.log(`  TLS:    ${tlsOptions ? 'on' : 'off'}`);
    console.log(`  Wire:   ${isWireEncryptionEnabled() ? 'on' : 'off'} (GPS socket)`);
    console.log(`  Content AES: ${isContentEncryptionReady() ? 'on' : 'off'}`);
    console.log(`  Voice E2EE: ${isVoiceE2eeReady() ? 'on' : 'off'}`);
    startPrivateCallSweeper(io);
  });
}

initFcm();
startBackupScheduler();
start();
