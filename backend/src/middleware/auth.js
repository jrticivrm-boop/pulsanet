import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
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
