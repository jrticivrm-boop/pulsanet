/**
 * URL LiveKit alcanzable desde el navegador.
 *
 * En página HTTPS no se puede abrir ws:// (mixed content bloqueado).
 * Ahí usamos el mismo origen (wss://host:5173); Vite hace proxy /rtc → LiveKit :7880.
 * El medio RTC (UDP 7882 / TCP 7881) sigue yendo directo al node-ip público.
 *
 * En HTTP o clientes nativos: conserva el host del API (p. ej. ws://IP_PUBLICA:7880).
 */
export function publicLiveKitUrl(url, fallbackHost) {
  if (!url) return url;

  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    const raw = String(url);
    if (raw.startsWith('wss://')) {
      const pageHost = window.location.hostname;
      if (pageHost && pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
        return raw
          .replace(/127\.0\.0\.1/g, pageHost)
          .replace(/localhost/gi, pageHost);
      }
      return raw;
    }
    // ws:// bajo HTTPS → misma origen (proxy Vite)
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
