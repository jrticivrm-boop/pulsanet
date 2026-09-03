/**
 * URL LiveKit alcanzable desde el navegador.
 *
 * En HTTPS siempre usamos el mismo origen (wss://host) para la señal WebSocket:
 * - Consola local :5173 → proxy Vite `/rtc` → LiveKit :7880
 * - Dominio público :443 → proxy Caddy `/rtc` → LiveKit :7880
 *
 * Evita mixed content (ws:// bajo HTTPS) y hairpin cuando el API devuelve
 * wss://dominio-publico pero la consola está en https://127.0.0.1:5173.
 *
 * Media RTC (UDP 7882 / TCP 7881) sigue directo al node-ip público.
 */
export function publicLiveKitUrl(url, fallbackHost) {
  if (!url) return url;

  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return `wss://${window.location.host}`;
  }

  let host = fallbackHost;
  if (typeof window !== 'undefined') {
    const pageHost = window.location.hostname;
    if (pageHost && pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
      host = pageHost;
    }
  }
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    host = '192.168.1.66';
  }
  return String(url)
    .replace(/127\.0\.0\.1/g, host)
    .replace(/localhost/gi, host);
}
