# Matriz de prueba — Panel web progresivo

Usar tras cada fase. Marcar ☐ → ☑ en dispositivo real (no solo DevTools).

## Entornos

| # | Dispositivo / navegador | URL HTTPS | Notas |
|---|-------------------------|-----------|-------|
| A | Chrome desktop (1366×768+) | | Referencia sin regresión |
| B | Chrome Android (phone) | | |
| C | Safari iOS (phone) | | Autoplay / getUserMedia |
| D | Tablet Android o iPad | | |
| E | Chrome DevTools phone + tablet | | Solo smoke rápido |

## Checklist por área

### Base (Fase 0+)
- [ ] Login visible y usable (teclado no tapa submit de forma irrecuperable)
- [ ] Tema claro/oscuro
- [ ] Sin zoom forzado bloqueado (`user-scalable` libre)
- [ ] `data-layout` en `<html>` = phone | tablet | desktop según ancho

### Shell (Fase 1+)
- [ ] Phone: rail no come >30% del ancho (oculto / drawer / bottom nav)
- [ ] Safe-area: notch / home indicator no tapan topbar ni composer
- [ ] PTT alcanzable (≥44px)
- [ ] Desktop: rail y topbar como antes

### Chat (Fase 2+)
- [ ] Phone: lista XOR hilo + Atrás
- [ ] Enviar texto / imagen / audio
- [ ] Personas / ficha peer sin Ctrl+K

### Media (Fase 3+)
- [ ] Llamada 1:1 contestar/colgar
- [ ] PTT hold en radio
- [ ] Videollamada o Ver cámara (1 feed) si aplica rol
- [ ] Geolocalización: mensaje claro si permiso denegado

### Limitación web vs APK (Fase 3)
- El panel web **no** tiene Foreground Service: audio/PTT/llamadas requieren **mantener la pestaña abierta** (Safari iOS suspende en background).
- Un gesto del usuario (toque/tecla) desbloquea audio vía `unlockMediaAudio` (panic + notificaciones + PTT).
- Cámara/mic/geo requieren **HTTPS** (secure context); si falla, el mensaje debe ser legible en español.

### Despacho (Fase 4+)
- [ ] Tablet: mapa u ops usable
- [ ] Phone: pinch — al menos una superficie primaria sin scroll horizontal de página
- [ ] Desktop: mosaico multi-panel intacto

### PWA (Fase 5+)
- [ ] Manifest / Add to Home Screen (Android)
- [ ] Icono correcto iOS Add to Home Screen
- [ ] Offline: shell + aviso, no pantalla blanca
- **Nota Web Push:** el SW actual cubre notificaciones mostradas desde la pestaña (`sw-notify.js`). VAPID push remota no está en alcance; iOS Safari tiene límites fuertes fuera de PWA instalada.

## Regresión desktop (siempre)

- [ ] `/despacho` Command Center multi-panel
- [ ] `/despacho/video` multi-monitor
- [ ] `/radio` PTT + chats
- [ ] Llamadas / Personas / Ctrl+K
