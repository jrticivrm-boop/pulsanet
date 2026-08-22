/**
 * Prueba de carga Mes 5 — N clientes Socket.IO concurrentes.
 *
 * Uso:
 *   node src/scripts/loadtest.js
 *   USERS=50 CONCURRENCY=20 HOLD_MS=400 node src/scripts/loadtest.js
 *
 * Requiere: API arriba, Redis, npm run seed && npm run seed:load
 */
import { io } from 'socket.io-client';

const API = process.env.API_URL || 'http://127.0.0.1:4000';
const USERS = parseInt(process.env.USERS || '100', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '25', 10);
const HOLD_MS = parseInt(process.env.HOLD_MS || '300', 10);
const ROUNDS = parseInt(process.env.ROUNDS || '3', 10);
const PASSWORD = 'demo1234';

const stats = {
  logins: 0,
  loginErrors: 0,
  connected: 0,
  connectErrors: 0,
  joins: 0,
  granted: 0,
  denied: 0,
  chats: 0,
  chatErrors: 0,
  disconnects: 0,
};

async function login(email) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `login ${res.status}`);
  stats.logins += 1;
  return data;
}

async function fetchGroupId(token) {
  const res = await fetch(`${API}/api/groups`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.groups?.[0]?.id) throw new Error('Sin grupos');
  return data.groups[0].id;
}

function connectClient(token, groupId, displayName) {
  return new Promise((resolve, reject) => {
    const socket = io(API, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('timeout connect'));
    }, 12000);

    socket.on('connect', () => {
      clearTimeout(timer);
      stats.connected += 1;
      socket.emit('ptt:join', { groupId });
      stats.joins += 1;
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      stats.connectErrors += 1;
      reject(err);
    });
    socket.on('disconnect', () => {
      stats.disconnects += 1;
    });
    socket.on('ptt:granted', () => {
      stats.granted += 1;
    });
    socket.on('ptt:denied', () => {
      stats.denied += 1;
    });
    socket.on('chat:error', () => {
      stats.chatErrors += 1;
    });
    socket.dataMeta = { displayName, groupId };
  });
}

async function mapPool(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function main() {
  console.log(`Load test → ${API}`);
  console.log(`Users=${USERS} concurrency=${CONCURRENCY} rounds=${ROUNDS} holdMs=${HOLD_MS}`);
  const t0 = Date.now();

  const emails = Array.from({ length: USERS }, (_, i) => {
    const n = String(i + 1).padStart(3, '0');
    return `loaduser${n}@tacticalptx.local`;
  });

  const sessions = [];
  await mapPool(emails, CONCURRENCY, async (email) => {
    try {
      const data = await login(email);
      const groupId = await fetchGroupId(data.token);
      sessions.push({
        email,
        token: data.token,
        groupId,
        displayName: data.user.displayName,
      });
    } catch (err) {
      stats.loginErrors += 1;
      console.error(`login fail ${email}:`, err.message);
    }
  });

  console.log(`Logins OK: ${sessions.length}/${USERS}`);

  const sockets = [];
  await mapPool(sessions, CONCURRENCY, async (s) => {
    try {
      const sock = await connectClient(s.token, s.groupId, s.displayName);
      sock.session = s;
      sockets.push(sock);
    } catch (err) {
      console.error(`connect fail ${s.email}:`, err.message);
    }
  });

  console.log(`Sockets: ${sockets.length}`);
  if (sockets.length === 0) {
    console.error('Sin sockets — abortando (revisa API / seed:load / RATE_LIMIT_MAX)');
    process.exit(1);
  }
  await sleep(500);

  // Liberar floor residual antes de medir grants
  sockets.forEach((s) => s.emit('ptt:release', { groupId: s.session.groupId }));
  await sleep(400);

  // Grant garantizado (un solo hablante)
  const first = sockets[0];
  await new Promise((resolve) => {
    const onGranted = () => {
      first.off('ptt:granted', onGranted);
      resolve();
    };
    first.on('ptt:granted', onGranted);
    first.emit('ptt:request', { groupId: first.session.groupId });
    setTimeout(resolve, 2000);
  });
  await sleep(HOLD_MS);
  first.emit('ptt:release', { groupId: first.session.groupId });
  await sleep(300);
  await mapPool(sockets.slice(0, Math.min(50, sockets.length)), 20, async (sock) => {
    sock.emit('chat:send', {
      groupId: sock.session.groupId,
      body: `ping ${sock.session.displayName} ${Date.now()}`,
    });
    stats.chats += 1;
  });
  await sleep(800);

  // PTT rounds — one speaker at a time should grant; parallel should deny
  for (let r = 0; r < ROUNDS; r++) {
    const speaker = sockets[r % sockets.length];
    if (!speaker) break;
    const contenders = sockets.slice(0, Math.min(10, sockets.length));

    await Promise.all(
      contenders.map(
        (s) =>
          new Promise((resolve) => {
            s.emit('ptt:request', { groupId: s.session.groupId });
            setTimeout(resolve, 50);
          })
      )
    );
    await sleep(HOLD_MS);
    speaker.emit('ptt:release', { groupId: speaker.session.groupId });
    // release all who might hold
    contenders.forEach((s) => s.emit('ptt:release', { groupId: s.session.groupId }));
    await sleep(200);
  }

  // Presence ping
  sockets.forEach((s) => s.emit('presence:ping', { groupId: s.session.groupId }));
  await sleep(500);

  let metrics = null;
  try {
    const res = await fetch(`${API}/api/metrics`);
    metrics = await res.json();
  } catch {
    /* optional */
  }

  sockets.forEach((s) => s.close());
  await sleep(300);

  const elapsed = Date.now() - t0;
  console.log('\n=== RESULTADO ===');
  console.log(JSON.stringify({ elapsedMs: elapsed, stats, metrics }, null, 2));

  const ok =
    stats.loginErrors === 0 &&
    stats.connectErrors === 0 &&
    sockets.length >= Math.floor(USERS * 0.9) &&
    stats.granted >= 1;

  if (!ok) {
    console.error('Load test NO cumplió umbrales mínimos');
    process.exit(1);
  }
  console.log('Load test OK');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
