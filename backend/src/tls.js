import fs from 'fs';
import { config } from './config.js';

/**
 * Carga certificados PEM si TLS_CERT / TLS_KEY están.
 * Generar: node infra/generate-lan-certs.mjs
 */
export function loadTlsOptions() {
  const certPath = config.tls.certPath;
  const keyPath = config.tls.keyPath;
  if (!certPath || !keyPath) return null;

  try {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  } catch (err) {
    console.error('TLS: no se pudieron leer certificados:', err.message);
    console.error(`  TLS_CERT=${certPath}`);
    console.error(`  TLS_KEY=${keyPath}`);
    if (config.isProd) process.exit(1);
    return null;
  }
}
