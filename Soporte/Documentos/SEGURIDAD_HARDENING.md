# TacticalPtx — Endurecimiento de seguridad / ops

**Fecha referencia:** 2026-08-25  
**Script:** `infra/HARDEN.cmd` (o `HARDEN.ps1`)

## Qué aplica el harden

1. **PostgreSQL** → StartType **Automatic** + arranque (evita login caído tras reinicio).
2. **Firewall** canónico (`Ensure-Firewall.ps1`) incl. **UDP 3478** (TURN LiveKit).
3. **UPnP** reforzado: 4000, 5173, 7880, 7881, 7882, **3478**.
4. **`.env`:**
   - `APP_UPDATE_SECRET` (≥32) — OTA APK exige header `X-App-Update-Key`
   - `ALLOW_HOST_LOCKDOWN=1` — intrusión puede cerrar FW/UPnP/procesos
   - `RATE_LIMIT_MAX=400`, `LOGIN_RATE_MAX=25`, `APP_UPDATE_RATE_MAX=40`
   - `WEB_PUBLIC_URL=https://IP:5173`
5. Copia del secreto OTA en `Soporte/Secrets/app-update-secret.env` (gitignored).

## OTA endurecida

- Manifiesto: requiere secreto si `APP_UPDATE_SECRET` está definido.
- Descarga APK: token HMAC de corta vida (`?t=exp.sig`).
- Rate-limit dedicado en `/api/app/*`.
- Apps: build con `--dart-define=APP_UPDATE_SECRET=...` (`PUBLISH-APK-UPDATE.cmd` / `BUILD-APK-WHATSAPP.cmd` lo leen del `.env` o Secrets).

## LiveKit TURN

- `infra/livekit.dev.yaml`: `turn.enabled` + UDP **3478** + relay 50000–50200.
- Ayuda cuando el operador 4G bloquea UDP 7882; no sustituye un TURN TLS con dominio público.

## Tras harden

1. `LEVANTAR-TACTICALPTX.bat`
2. Publicar APK nueva (incluye secreto): `mobile\scripts\PUBLISH-APK-UPDATE.cmd`
3. Consola remota: `https://189.175.38.29:5173` (aceptar cert)
4. Health: `https://189.175.38.29:4000/api/health`

## Desbloqueo lockdown

`POST /api/security/unlock` con `LOCKDOWN_UNLOCK_SECRET`, luego `HARDEN.cmd` + `LEVANTAR`.

## Pendiente (fuera de este host)

- Certificado público (Let’s Encrypt) con **dominio** (no solo IP).
- TURN TLS 5349 con ese dominio.
- Play Store / iOS.
