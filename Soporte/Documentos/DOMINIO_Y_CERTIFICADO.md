# TacticalPtx — Dominio y certificado público (HTTPS sin aviso)

## Objetivo

Dejar de usar certificado **autofirmado** en el acceso remoto. El navegador y la app confían en un cert **Let's Encrypt**.

## Modo rápido (sin comprar dominio): sslip.io

La IP pública actual se expone como:

```text
https://TU.IP.PUBLICA.sslip.io
```

Ejemplo (IP actual del host): `https://189.152.200.238.sslip.io`

### Arranque

1. Stack local arriba: `LEVANTAR-TACTICALPTX.bat`
2. Borde HTTPS:

```bat
D:\pulsanet\infra\START-PUBLIC-EDGE.cmd
```

Eso:

- Abre firewall/UPnP **80** y **443**
- Arranca **Caddy** (`infra/caddy/caddy.exe`) con `Caddyfile.edge`
- Pide certificado Let's Encrypt (ACME HTTP-01)
- Actualiza `WEB_PUBLIC_URL`, `PUBLIC_DOMAIN`, `LIVEKIT_PUBLIC_HOST`, CORS en `backend/.env`

3. Reinicia la API (cerrar ventana API y `LEVANTAR`, o solo la ventana API) para cargar CORS.
4. Publica APK con:

```bat
set API_BASE=https://TU.IP.PUBLICA.sslip.io
D:\pulsanet\mobile\scripts\PUBLISH-APK-UPDATE.cmd
```

### URLs

| Uso | URL |
|-----|-----|
| Consola | `https://…sslip.io/` |
| Health | `https://…sslip.io/api/health` |
| APK `API_BASE` | `https://…sslip.io` (puerto 443, sin `:4000`) |

LiveKit media (UDP/TCP 7881/7882/3478) sigue por la **IP pública**; solo la señal web va por `/rtc` en el dominio.

## Dominio propio (recomendado a medio plazo)

1. Compra/apunta DNS: registro **A** → IP pública del servidor.
2. Arranca:

```powershell
powershell -File infra\START-PUBLIC-EDGE.ps1 -Domain app.tudominio.mx -Email admin@tudominio.mx
```

3. Misma publicación de APK con `API_BASE=https://app.tudominio.mx`.

## Requisitos

- IP pública alcanzable (no CGNAT)
- Router: reenvío **TCP 80** y **TCP 443** a la PC (UPnP o manual)
- Puertos LiveKit (7880–7882, 3478) siguen necesarios para audio

## IP dinámica → dominio permanente (recomendado)

`*.sslip.io` **incluye la IP en el nombre**: si el ISP cambia la IP, el APK deja de conectar hasta republicar.

Ancla permanente con **DuckDNS** (gratis):

1. Crea cuenta en https://www.duckdns.org y un subdominio (ej. `tacticalptx`).
2. Ejecuta una sola vez:

```powershell
powershell -File infra\SETUP-STABLE-DOMAIN.ps1 -Subdomain tacticalptx -Token TU_TOKEN
```

Eso fija `STABLE_PUBLIC_DOMAIN=tacticalptx.duckdns.org`, actualiza el DNS A, reinicia Caddy con Let's Encrypt y alinea `.env` / LiveKit.

3. Publica APK (queda con ese hostname para siempre):

```bat
mobile\scripts\PUBLISH-APK-UPDATE.cmd
```

Cuando cambie la IP, `Sync-PublicIp` / `Watch-Stack` actualizan DuckDNS automáticamente. **No hace falta otro APK por cambio de IP.**

Token en `Soporte\Secrets\stable-domain.env` (no versionar).

## IP dinámica (modo sslip, sin ancla)

Si el ISP cambia la IP, el hostname `*.sslip.io` cambia: hay que **re-ejecutar** `START-PUBLIC-EDGE` y **republicar APK** (o usar dominio propio + DDNS como arriba).

## Archivos

- `infra/Caddyfile.edge`
- `infra/START-PUBLIC-EDGE.ps1` / `.cmd`
- `infra/caddy/caddy.exe` (binario local, no secretos)
