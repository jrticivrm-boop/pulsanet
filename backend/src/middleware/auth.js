/**
 * Auth JWT + perfil vivo desde BD (displayName/rol no se congelan en el token).
 */
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { bindLiveUser } from '../services/userProfile.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }
  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret);
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }

  bindLiveUser(payload)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ ok: false, error: 'Usuario inactivo o no encontrado' });
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
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}
