import http from 'http';
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
import { geofencesRouter } from './routes/geofences.js';
import { createRecordingsRouter } from './routes/recordings.js';
import { createMetricsRouter } from './routes/metrics.js';
import { devicesRouter } from './routes/devices.js';
import { stickersRouter } from './routes/stickers.js';
import { createPanicRouter } from './routes/panic.js';
import { registerPttHandlers } from './socket/ptt.js';
import { registerChatHandlers } from './socket/chat.js';
import { registerDispatchHandlers } from './socket/dispatch.js';
import { registerDmHandlers } from './socket/dm.js';
import { createDmRouter } from './routes/dm.js';
import { createCallsRouter } from './routes/calls.js';
import { isLiveKitConfigured } from './services/livekit.js';
import { connectRedis, isRedisReady } from './redis.js';
import { inc } from './services/metrics.js';
import { initFcm, isFcmReady } from './services/fcm.js';

const app = express();
const server = http.createServer(app);

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

const io = new Server(server, {
  cors: { origin: config.corsOrigins, credentials: true },
  maxHttpBufferSize: 1e6,
  pingTimeout: 20000,
  pingInterval: 10000,
});

app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const messagesRouter = wrapRouterAsync(createMessagesRouter(io));
const metricsRouter = wrapRouterAsync(createMetricsRouter(io));
const locationsRouter = wrapRouterAsync(createLocationsRouter(io));
const recordingsRouter = createRecordingsRouter(io);
const mediaRouter = wrapRouterAsync(createMediaRouter());
const dmRouter = wrapRouterAsync(createDmRouter(io));
const callsRouter = wrapRouterAsync(createCallsRouter(io));

app.use('/api/health', wrapRouterAsync(healthRouter));
app.use('/api/metrics', metricsRouter);
app.use('/api/auth', wrapRouterAsync(authRouter));
app.use('/api/groups', wrapRouterAsync(groupsRouter));
app.use('/api/groups/:id/messages', messagesRouter);
app.use('/api/dm', dmRouter);
app.use('/api/calls', callsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/livekit', wrapRouterAsync(livekitRouter));
app.use('/api/admin', wrapRouterAsync(adminRouter));
app.use('/api/locations', locationsRouter);
app.use('/api/geofences', wrapRouterAsync(geofencesRouter));
app.use('/api/recordings', recordingsRouter);
app.use('/api/devices', wrapRouterAsync(devicesRouter));
app.use('/api/stickers', wrapRouterAsync(stickersRouter));
app.use('/api/panic', wrapRouterAsync(createPanicRouter(io)));

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No autorizado'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    socket.data.user = {
      sub: payload.sub,
      role: payload.role,
      displayName: payload.displayName || 'Usuario',
      orgId: payload.orgId,
    };
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  inc('socketConnects');
  socket.on('disconnect', () => inc('socketDisconnects'));
});

registerPttHandlers(io);
registerChatHandlers(io);
registerDispatchHandlers(io);
registerDmHandlers(io);

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

app.use((err, _req, res, _next) => {
  console.error('API error:', err);
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: 'Error interno' });
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

  server.listen(config.port, () => {
    console.log(`TacticalPtx API v${config.version} [${config.nodeEnv}] → http://localhost:${config.port}`);
    console.log(`  Health: GET /api/health`);
    console.log(`  Login:  POST /api/auth/login`);
    console.log(`  Redis:  ${isRedisReady() ? 'ok' : 'fail'}`);
    console.log(`  LiveKit: ${isLiveKitConfigured() ? config.livekit.url : 'NO CONFIGURADO'}`);
    console.log(`  FCM:    ${isFcmReady() ? 'ok' : 'off'}`);
  });
}

initFcm();
start();
