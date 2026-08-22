# PulsaNet — Auditoría Mes 1–6 (estado real)

**Fecha:** 2026-08-11 · **API:** v1.4.0

> Informe narrativo por mes: [INFORME_DESARROLLO_POR_MES.md](INFORME_DESARROLLO_POR_MES.md)  
> Copia en Soporte: `D:\PulsaNet_Soporte\Documentos\INFORME_DESARROLLO_POR_MES.md`

## Resumen por mes

| Mes | Hito | Estado código | Notas |
|-----|------|---------------|-------|
| 1 | Auth, grupos, PTT demo web | OK | Sin auto-registro público |
| 2 | Presencia Redis, chat, reconnect | OK | Corregido: presencia stale; chat 90 días |
| 3 | Android alpha | OK | Rebuild con `API_BASE` LAN; audio speakerphone |
| 4 | Despacho web + iOS prep | Parcial | Mapa con seed/API; iOS sin Mac; CSV UI OK |
| 5 | Piloto / loadtest | OK | Operacional: `npm run loadtest` |
| 6 | Producción Docker + harden | OK (prep) | Compose listo; stores/FCM externos |

## Bugs corregidos en esta pasada

1. `listen_only` ya **no puede tomar el floor** PTT  
2. Presencia: heartbeat + limpieza de fantasmas offline (~90 s)  
3. JWT refresh (`/api/auth/refresh`) + rotación; default access **8h**  
4. Middleware async Express (errores DB → 500 JSON)  
5. Historial chat limitado a **90 días**  
6. Web: refresh en 401, export CSV en despacho, rol `listen_only` al asignar  
7. Mobile: polling Socket.IO, refresh token, speakerphone LiveKit  

## v1.1 / v1.2 / v1.3

- v1.1 Multimedia + GPS + rutas — [V1_1_MEDIA_GPS.md](V1_1_MEDIA_GPS.md)
- v1.2 FCM cableado (requiere credenciales Firebase)
- v1.3 Geocercas — [V1_3_GEOFENCES.md](V1_3_GEOFENCES.md)
- v1.4 Grabación PTT (web) — [V1_4_RECORDINGS.md](V1_4_RECORDINGS.md)

## Qué falta (alcance pendiente)

| Ítem | Bloqueo |
|------|---------|
| Push FCM real | Cuenta Firebase + `google-services.json` + service account (código listo; ver `docs/FCM_PUSH.md`) |
| Publicar Play / App Store | Cuentas developer + revisión |
| Build iOS / TestFlight | Mac + Apple Developer |
| Grabación de llamadas / radio interop | Fuera de alcance actual |
| Docker en esta PC | Docker no instalado (compose sí) |
| Auto-registro usuarios | Solo admin crea cuentas |

## Qué se necesita para continuar

1. **Demo diaria:** Redis + LiveKit + API + Vite (`npm run dev` en `web`)  
2. **Móvil físico:** USB + `flutter run --dart-define=API_BASE=http://IP:4000` + firewall 4000/7880  
3. **Producción VPS:** instalar Docker → `infra/docker-compose.prod.yml` + `.env.prod`  
4. **Stores:** keystore ya generado (respaldar `.jks`); AAB en `mobile/build/.../app-release.aab`  

## Stack al auditar

- API :4000 OK · Redis OK · LiveKit OK · Postgres OK  
- Vite :5173 a menudo caído → reiniciar `cd web && npm run dev`  
- `adb`: sin teléfono conectado  
