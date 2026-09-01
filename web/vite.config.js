import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certFile = path.resolve(__dirname, '../infra/certs/lan-cert.pem');
const keyFile = path.resolve(__dirname, '../infra/certs/lan-key.pem');
const https =
  fs.existsSync(certFile) && fs.existsSync(keyFile)
    ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
    : undefined;

/** Proxy a API local: HTTPS si hay certs LAN (misma condición que TLS de la API), si no HTTP. */
const apiTarget =
  process.env.VITE_API_PROXY ||
  (https ? 'https://127.0.0.1:4000' : 'http://127.0.0.1:4000');
/** LiveKit señal (ws) local — el navegador en HTTPS usa wss same-origin → aquí. */
const livekitTarget = process.env.VITE_LIVEKIT_PROXY || 'http://127.0.0.1:7880';

const proxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
    secure: false,
  },
  // Trailing slash: handshake Engine.IO + upgrade WS (evita xhr poll error por proxy)
  '/socket.io': {
    target: apiTarget,
    ws: true,
    changeOrigin: true,
    secure: false,
    timeout: 60_000,
    proxyTimeout: 60_000,
  },
  // livekit-client conecta a {url}/rtc — sin esto, HTTPS + ws://7880 = mixed content
  '/rtc': {
    target: livekitTarget,
    ws: true,
    changeOrigin: true,
    secure: false,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    ...(https ? { https } : {}),
    proxy,
  },
  preview: {
    port: 5173,
    ...(https ? { https } : {}),
    proxy,
  },
});
