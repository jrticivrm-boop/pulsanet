import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Directorio de manifiestos/APK: APP_UPDATES_DIR o backend/app-updates */
export function resolveAppUpdatesDir() {
  const fromEnv = (process.env.APP_UPDATES_DIR || '').trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(__dirname, '../../app-updates');
}

function readAndroidManifest(dir) {
  const candidates = [
    path.join(dir, 'android.json'),
    path.join(dir, 'android-update.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      // Strip BOM (PowerShell Set-Content -Encoding utf8 lo mete y rompe JSON.parse).
      const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') continue;
      return { file, data };
    } catch (err) {
      console.warn(`[app-update] manifiesto inválido ${file}:`, err.message);
    }
  }
  return null;
}

/** Corrige ellipsis mojibake (Actualizandoâ€¦ -> Actualizando...). */
function sanitizeUpdateMessage(raw) {
  return String(raw || '')
    .replace(/â€¦|â€\u00a6|\u2026|…/g, '...')
    .trim();
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function looksLikeJwt(token) {
  const parts = String(token || '').split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/**
 * Autoriza manifiesto OTA solo con APP_UPDATE_SECRET:
 * X-App-Update-Key / X-TacticalPtx-Update-Key / Bearer (secreto, no JWT).
 * Query ?key= deshabilitado (fuga en logs/proxies).
 */
function requireUpdateKey(req, res, next) {
  const secret = config.appUpdateSecret;
  if (!secret) {
    if (config.isProd) {
      return res.status(503).json({
        ok: false,
        error: 'OTA no configurada (APP_UPDATE_SECRET)',
      });
    }
    return next();
  }

  const headerKey = (
    req.get('x-app-update-key') ||
    req.get('x-tacticalptx-update-key') ||
    ''
  ).trim();
  if (headerKey && timingSafeEqualStr(headerKey, secret)) {
    return next();
  }

  const auth = req.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) {
    const tok = m[1].trim();
    // Solo secreto OTA en Bearer — no JWT de sesión
    if (!looksLikeJwt(tok) && timingSafeEqualStr(tok, secret)) {
      return next();
    }
  }

  return res.status(401).json({ ok: false, error: 'No autorizado' });
}

function signDownloadToken(fileName, expSec) {
  const secret = config.appUpdateSecret;
  if (!secret) return null;
  const payload = `${path.basename(fileName)}.${expSec}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${expSec}.${sig}`;
}

function verifyDownloadToken(fileName, token) {
  const secret = config.appUpdateSecret;
  if (!secret) return true; // sin secreto: solo rate-limit (dev)
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return false;
  const expSec = parseInt(parts[0], 10);
  const sig = parts[1];
  if (!Number.isFinite(expSec) || expSec * 1000 < Date.now()) return false;
  const expect = signDownloadToken(fileName, expSec);
  if (!expect) return false;
  return timingSafeEqualStr(token, expect);
}

function resolveApkUrl(req, data, updatesDir, token) {
  const fileName = String(data.apkFile || data.file || 'TacticalPtx.apk').trim();
  const abs = path.join(updatesDir, 'files', path.basename(fileName));
  if (!fs.existsSync(abs) && !String(data.apkUrl || data.url || '').trim()) {
    return null;
  }

  const explicit = String(data.apkUrl || data.url || '').trim();
  if (explicit && /^https?:\/\//i.test(explicit) && !config.appUpdateSecret) {
    return explicit;
  }

  const base = `${req.protocol}://${req.get('host')}`;
  const name = path.basename(fileName);
  let url = `${base}/api/app/android/file/${encodeURIComponent(name)}`;
  if (token) url += `?t=${encodeURIComponent(token)}`;
  return url;
}

/**
 * Límite solo del manifiesto OTA. Todos los móviles detrás de NAT/Caddy
 * comparten una IP pública: 40/15min bloqueaba a toda la flota (HTTP 429).
 * La descarga del APK va con token HMAC y no cuenta aquí.
 */
const otaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.APP_UPDATE_RATE_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes de actualización. Espera unos minutos.' },
  skip: (req) => /\/android\/file\//i.test(req.path || ''),
});

export function createAppUpdateRouter() {
  const router = Router();
  const updatesDir = resolveAppUpdatesDir();

  router.get('/android', otaLimiter, requireUpdateKey, (req, res) => {
    const found = readAndroidManifest(updatesDir);
    if (!found) {
      return res.json({
        ok: true,
        updateAvailable: false,
        configured: false,
        message: 'Sin manifiesto de actualización',
      });
    }

    const { data } = found;
    const versionCode = parseInt(data.versionCode ?? data.version_code ?? 0, 10) || 0;
    const versionName = String(data.versionName || data.version_name || '').trim() || null;
    const force = data.force !== false && data.mandatory !== false;
    const rawMessage = String(data.message || '').trim();
    const message = /banje\s*cel/i.test(rawMessage)
      ? 'Actualizando...'
      : sanitizeUpdateMessage(rawMessage) || 'Actualizando...';

    const fileName = String(data.apkFile || data.file || 'TacticalPtx.apk').trim();
    const ttlSec = Math.max(
      60,
      parseInt(process.env.APP_UPDATE_TOKEN_TTL_SEC || '3600', 10) || 3600
    );
    const expSec = Math.floor(Date.now() / 1000) + ttlSec;
    const token = config.appUpdateSecret ? signDownloadToken(fileName, expSec) : null;
    const apkUrl = resolveApkUrl(req, data, updatesDir, token);

    if (!apkUrl || versionCode < 1) {
      return res.json({
        ok: true,
        updateAvailable: false,
        configured: true,
        versionCode,
        versionName,
        message: 'Manifiesto incompleto (versionCode / APK)',
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      configured: true,
      updateAvailable: true,
      package: data.package || 'com.tacticalptx.app',
      versionCode,
      versionName,
      apkUrl,
      sha256: data.sha256 ? String(data.sha256).toLowerCase() : null,
      force,
      message,
      expiresAt: token ? expSec : null,
      minSupportedVersionCode:
        parseInt(data.minSupportedVersionCode ?? data.min_supported_version_code ?? 0, 10) ||
        null,
    });
  });

  router.get('/android/file/:name', (req, res) => {
    const name = path.basename(String(req.params.name || ''));
    if (!name || !/\.apk$/i.test(name)) {
      return res.status(400).json({ ok: false, error: 'Nombre de APK inválido' });
    }
    if (config.appUpdateSecret) {
      const t = String(req.query?.t || '');
      if (!verifyDownloadToken(name, t)) {
        return res.status(401).json({ ok: false, error: 'Enlace de descarga inválido o expirado' });
      }
    }
    const abs = path.join(updatesDir, 'files', name);
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ ok: false, error: 'APK no encontrada' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.sendFile(abs);
  });

  return router;
}
