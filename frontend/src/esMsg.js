/**
 * Normaliza errores técnicos (navegador, LiveKit, fetch, HTTP) a mensajes en español
 * para mostrar al operador. Si el texto ya viene en español del API, se respeta.
 */
export function esMsg(raw, fallback = 'Ocurrió un error') {
  if (raw == null || raw === '') return fallback;
  const s = String(raw).trim();
  if (!s) return fallback;

  const lower = s.toLowerCase();

  if (
    /securecontextrequired|mediaDevices|getusermedia|not a secure context|insecure context|only secure origins/i.test(
      s
    ) ||
    /cannot read propert.*(getusermedia|mediadevices)/i.test(s)
  ) {
    return 'Abre la consola por HTTPS (p. ej. https://IP:5173). En HTTP el navegador no permite el micrófono ni el PTT.';
  }
  if (
    /permission denied|notallowederror|permission dismissed|user denied|permission.*microphone|microphone.*permission/i.test(
      s
    )
  ) {
    return 'Micrófono bloqueado. Permite el acceso en el navegador y recarga la página.';
  }
  if (/permission.*camera|camera.*permission|notallowederror.*video|video.*notallowed/i.test(s)) {
    return 'Cámara bloqueada. Permite el acceso en el navegador y recarga la página.';
  }
  if (
    /geolocation|position.*unavailable|location.*denied|user denied geolocation|only secure origins.*geolocation/i.test(
      s
    )
  ) {
    return 'Ubicación no disponible. Permite geolocalización (requiere HTTPS) o revisa el permiso del navegador.';
  }
  if (/notreadableerror|track.?start|device in use|could not start/i.test(s)) {
    return 'No se pudo abrir el micrófono (puede estar en uso por otra aplicación).';
  }
  if (/notfounderror|requested device not found|no device/i.test(s)) {
    return 'No se encontró micrófono en este equipo.';
  }
  if (/overconstrained|constraint/i.test(s) && !/messages_target/i.test(s)) {
    return 'El micrófono no cumple los requisitos de audio.';
  }
  if (/messages_target|viola la restricci[oó]n.*messages_target|violates check constraint.*messages_target/i.test(s)) {
    return 'No se pudo guardar el mensaje. Cierra el chat, ábrelo de nuevo e intenta otra vez.';
  }
  if (/aborterror|the operation was aborted/i.test(s)) {
    return 'Operación cancelada.';
  }
  if (/xhr poll error|websocket error|transport error|server error/i.test(s)) {
    return 'Sin enlace en tiempo real (Socket.IO). Recarga con Ctrl+F5; si persiste, revisa red/firewall o el proxy /socket.io.';
  }
  if (/failed to fetch|networkerror|load failed|net::err_|econnrefused|network request failed/i.test(s)) {
    return 'Sin conexión con el servidor. Revisa la red o que el servicio esté encendido.';
  }
  if (/timeout|timed out|etimedout/i.test(s)) {
    return 'Tiempo de espera agotado. Intenta de nuevo.';
  }
  if (/unauthorized|jwt expired|invalid token|token expired|jwt malformed/i.test(s)) {
    return 'Sesión vencida. Vuelve a iniciar sesión.';
  }
  if (/forbidden|access denied|not authorized/i.test(s)) {
    return 'No tienes permiso para esta acción.';
  }
  if (/not found|404/i.test(s) && !/mensaje|usuario|grupo|media|llamada/i.test(s)) {
    return 'No encontrado.';
  }
  if (/livekit|room connection|could not establish|ice|websocket.*fail/i.test(s) && /fail|error|unable|could/i.test(s)) {
    return 'No se pudo conectar el audio (LiveKit). Revisa el servicio de voz.';
  }
  if (/connection.*refus|socket.*disconnect|transport close/i.test(s)) {
    return 'Se perdió la conexión. Reconectando…';
  }
  if (/^error\s*\d{3}$/i.test(s) || /^error \d+$/i.test(s)) {
    const code = s.replace(/\D/g, '');
    if (code === '429') {
      return 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
    }
    return `Error del servidor (${code}).`;
  }
  if (lower === 'error' || lower === 'unknown error' || lower === 'unknown') {
    return fallback;
  }
  if (lower === 'offline') return 'Fuera de línea';
  if (lower === 'online') return 'En línea';
  if (lower === 'connecting…' || lower === 'connecting...' || lower === 'connecting') {
    return 'Conectando…';
  }
  if (lower === 'ready') return 'Listo';

  // Ya en español (API / mensajes nuestros)
  if (
    /[áéíóúñ¿¡]/i.test(s) ||
    /^(no |sin |solo |mensaje|usuario|canal|sesión|micrófono|alerta|error al|máximo|completa|haz |pulsa)/i.test(
      s
    )
  ) {
    return s;
  }

  // Frases inglesas frecuentes sueltas
  const map = {
    'permission denied': 'Micrófono bloqueado. Permite el acceso en el navegador y recarga la página.',
    'not allowed': 'Acción no permitida por el navegador.',
    'network error': 'Error de red.',
    'internal server error': 'Error interno del servidor.',
    'bad request': 'Solicitud no válida.',
    'service unavailable': 'Servicio no disponible.',
  };
  if (map[lower]) return map[lower];

  return s;
}

export function esDeniedReason(reason) {
  const r = String(reason || '').toLowerCase();
  if (r === 'listen_only' || /solo escucha|listen.?only|sin ptt/i.test(r)) {
    return 'Solo escucha — sin PTT en este canal';
  }
  if (r === 'ocupado' || /busy|occupied|in use/i.test(r)) {
    return 'Canal ocupado — suelta y espera';
  }
  return esMsg(reason, 'No se pudo usar el PTT');
}
