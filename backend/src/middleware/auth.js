/**
 * Auth JWT + perfil vivo desde BD (displayName/rol no se congelan en el token).
 */
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { bindLiveUser } from '../services/userProfile.js';

const JWT_VERIFY_OPTS = { algorithms: ['HS256'] };

const MUST_CHANGE_ALLOW = [
  { method: 'POST', test: (u) => /\/api\/auth\/change-password\/?$/.test(u) },
  { method: 'POST', test: (u) => /\/api\/auth\/logout\/?$/.test(u) },
  { method: 'GET', test: (u) => /\/api\/auth\/me\/?$/.test(u) },
];

function isMustChangeAllowed(req) {
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  const method = String(req.method || 'GET').toUpperCase();
  return MUST_CHANGE_ALLOW.some((r) => r.method === method && r.test(url));
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, JWT_VERIFY_OPTS);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }
  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }

  bindLiveUser(payload)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ ok: false, error: 'Usuario inactivo o no encontrado' });
      }
      if (user.mustChangePassword && !isMustChangeAllowed(req)) {
        return res.status(403).json({
          ok: false,
          error: 'Debes cambiar la contraseña temporal antes de continuar',
          code: 'MUST_CHANGE_PASSWORD',
          mustChangePassword: true,
        });
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      console.error('authMiddleware profile:', err.message);
      res.status(500).json({ ok: false, error: 'Error de autenticación' });
    });
}

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      orgId: user.organization_id,
      tv: Number(user.token_version || user.tokenVersion || 1),
    },
    config.jwtSecret,
    { algorithm: 'HS256', expiresIn: config.jwtExpiresIn }
  );
}
