# TacticalPtx — Acceso directo sin Tailscale

Objetivo: que el celular (Wi‑Fi o **datos 4G/5G**) llegue a la API/LiveKit **sin app Tailscale** y **sin dominio**.

## Opciones (de más simple a más “campo”)

| Modo | ¿Datos móviles? | ¿Dominio? | Qué hace falta |
|------|-----------------|-----------|----------------|
| **A. Misma Wi‑Fi** | No | No | Solo `API_BASE=http://192.168.x.x:4000` |
| **B. Hotspot del PC** | No* | No | Celular se conecta al hotspot del PC; usa IP LAN del hotspot |
| **C. IP pública + reenvío** | Sí | **No** | Router: reenviar puertos a la PC |
| D. Túnel (ngrok/Cloudflare) | Sí | Sí (URL del túnel) | Cuenta + cliente; no es “directo” |
| E. Tailscale (actual) | Sí | MagicDNS opcional | App en PC y celular |

\*Con hotspot el celular no usa su 4G para llegar al servidor; usa la red del PC.

---

## Modo A — Oficina / casa (recomendado si hay Wi‑Fi)

1. PC y teléfono en la **misma red**.
2. IP de la PC (ejemplo): `192.168.1.66`
3. Firewall Windows: reglas canónicas `TacticalPtx-*` (TCP **4000**, **5173**, **7880**, **7881**; UDP **7882**, **50000-50200**). Ver `infra/Ensure-Firewall.ps1`.
4. APK:

```bat
set API_BASE=http://192.168.1.66:4000
D:\pulsanet\mobile\scripts\BUILD-APK-WHATSAPP.cmd
```

O el script ya usa LAN por defecto (ya **no** fuerza Tailscale).

---

## Modo C — 4G/5G sin Tailscale (IP pública)

Necesitas que el ISP te dé una **IP pública alcanzable** (no CGNAT). Si `EXPOSE-PUBLIC.ps1` muestra una IP `100.x` / `10.x` / `172.16–31.x` como “pública”, casi seguro hay **CGNAT** y el reenvío **no** funcionará desde fuera; en ese caso pide IP pública fija al proveedor o usa un VPS.

### 1) En la PC

```powershell
# Como Administrador
D:\pulsanet\infra\EXPOSE-PUBLIC.ps1
```

Eso:
- Detecta IP LAN y, si puede, IP pública vista desde Internet.
- Abre reglas de firewall para 4000 / 7880 / 7881 / 7882 (TCP) y UDP LiveKit.

### 2) En el router (reenvío / Virtual Server)

Apunta a la **IP LAN de la PC** (ej. `192.168.1.66`):

| Puerto externo | Interno | Protocolo | Servicio |
|----------------|---------|-----------|----------|
| 4000 | 4000 | TCP | API + Socket.IO (HTTPS) |
| 5173 | 5173 | TCP | Consola web Vite (**HTTPS** — requerido para PTT/mic desde fuera de localhost) |
| 7880 | 7880 | TCP | LiveKit señal |
| 7881 | 7881 | TCP | LiveKit RTC TCP |
| 7882 | 7882 | UDP | LiveKit RTC media |

Si el router solo permite TCP, prueba igual; el audio WebRTC puede degradar o fallar sin UDP **7882**.

### 2b) Consola web remota (PTT en el navegador)

El micrófono/`getUserMedia` **no funciona** en `http://IP_PUBLICA:5173` (contexto inseguro). Abrir siempre:

```
https://TU.IP.PUBLICA:5173
```

Ejemplo: `https://189.175.38.29:5173`

Vite usa el mismo cert LAN autofirmado que la API (`infra/certs/`). El navegador pedirá aceptar la excepción de seguridad una vez. `WEB_PUBLIC_URL` en `.env` debe ser esa URL HTTPS (el `GET /` de la API redirige ahí).

**Audio LiveKit bajo HTTPS:** el navegador **bloquea** `ws://IP:7880` (mixed content). La consola usa `wss://mismo-origen` (puerto 5173) y Vite hace proxy de `/rtc` → LiveKit local `:7880`. El media WebRTC sigue por **TCP 7881 / UDP 7882** hacia la IP pública (`LIVEKIT_PUBLIC_HOST` + `--node-ip`).

Localhost / LAN: `https://127.0.0.1:5173` o `https://192.168.x.x:5173` (también HTTPS si hay certs). HTTP solo en `localhost`/`127.0.0.1` suele permitir mic; no uses HTTP con IP pública.

### 3) APK apuntando a la IP pública (sin dominio)

```bat
set API_BASE=https://TU.IP.PUBLICA:4000
D:\pulsanet\mobile\scripts\BUILD-APK-WHATSAPP.cmd
```

Ejemplo: `https://189.175.38.29:4000`

### 4) LiveKit / ICE

URL de señal que entrega la API (móvil / referencia):

```
ws://189.175.38.29:7880
```

(con `LIVEKIT_PUBLIC_HOST=189.175.38.29`; LiveKit arranca con `--node-ip` esa misma IP).

Consola web HTTPS **no** abre ese `ws://` directo: usa `wss://189.175.38.29:5173` (proxy Vite).

Si el audio no llega desde 4G:
1. Confirma UDP **7882** y TCP **7881** abiertos (UPnP/`Reinforce-UPnP.ps1`).
2. Confirma que LiveKit se reinició con `node-ip` pública (`infra/start-services.ps1`).
3. Algunos operadores móviles bloquean UDP → el cliente debería caer a TCP 7881; si tampoco, hace falta TURN/TLS (no incluido en este stack LAN).
4. Override opcional en `.env`:

```env
LIVEKIT_PUBLIC_URL=ws://TU.IP.PUBLICA:7880
```

Reinicia servicios (`LEVANTAR-TACTICALPTX.bat`).

### 5) Seguridad (importante)

Exponer la API a Internet sin HTTPS es riesgoso. Para piloto corto:
- Cambia `JWT_SECRET`, contraseñas, `LIVEKIT_API_SECRET`.
- No dejes el puerto abierto más de lo necesario.
- Ideal después: reverse proxy **HTTPS** (Caddy/nginx) en 443 → 4000 (ahí sí suele haber dominio o certificado).

---

## Modo B — Hotspot del PC (sin router ni Tailscale)

1. Windows: Configuración → Red → Zona con cobertura móvil / Hotspot.
2. Celular se conecta a ese Wi‑Fi.
3. En el celular, la “LAN” del hotspot suele ser `192.168.137.1` (PC) o similar; mira `ipconfig` en la PC.
4. APK con esa IP: `API_BASE=http://192.168.137.1:4000`.

Útil para demos en campo sin Wi‑Fi de oficina.

---

## Comprobar

Desde el celular (navegador o `curl`):

- `http://IP:4000/api/health` → `"ready":true`
- Login web o APK contra esa misma IP.

Si health no abre desde 4G: CGNAT, firewall del ISP, o reenvío mal configurado.

---

## Qué ya no hace falta

- App Tailscale en el teléfono 
- MagicDNS / nombres `*.ts.net` 
- APK compilada con `100.x` 

Tailscale sigue siendo opción válida; este documento es la **alternativa directa**.

---

## Estado revisado 2026-08-22 (este sitio)

| Dato | Valor |
|------|--------|
| IP LAN PC | `192.168.1.66` |
| IP pública | `189.175.38.29` |
| CGNAT | **No** (IP pública real alcanzable en teoría) |
| API local TLS | `https://192.168.1.66:4000` → OK |
| Firewall Windows | Reglas canónicas `TacticalPtx-TCP/UDP-*` (4000, 5173, 7880, 7881, 7882, 50000-50200). Fuente: `infra/Ensure-Firewall.ps1` |
| UPnP (router) | TCP 4000/7880/7881 + UDP 7882 → LAN (`infra/EXPOSE-UPNP.ps1`) |

| Acceso desde Internet | **OK vía UPnP** (2026-08-22) — `https://189.175.38.29:4000/api/health` → 200 |
| APK 4G | `Soporte/APK/TacticalPtx-1.8.3+10-4G.apk` (`API_BASE=https://189.175.38.29:4000`) |
| Reaplicar UPnP | `infra/EXPOSE-UPNP.cmd` (tras reinicio del router) |

### Checklist router (tú / administración de red)

**Opción automática (recomendada):** en la PC del servidor ejecuta

`D:\pulsanet\infra\EXPOSE-UPNP.cmd`

Eso abre firewall Windows y crea reenvío **UPnP** (virtual) en el router hacia `192.168.1.66` (puertos 4000/7880/7881/7882). Revisado 2026-08-22: health pública HTTPS → **200**.

Si UPnP está desactivado en el router, haz reenvío manual:

Entrar al gateway (suele ser `http://192.168.1.254` o `http://192.168.1.1`) → **Port Forwarding / Virtual Server / NAT**:

| Nombre | Puerto externo | Interno | Proto | Destino |
|--------|----------------|---------|-------|---------|
| Tactical API | **4000** | 4000 | TCP | `192.168.1.66` |
| LiveKit señal | **7880** | 7880 | TCP | `192.168.1.66` |
| LiveKit RTC | **7881** | 7881 | TCP | `192.168.1.66` |
| LiveKit media | **7882** | 7882 | **UDP** | `192.168.1.66` |

Luego, desde el **celular en 4G** (Wi‑Fi apagado), abrir en el navegador:

`https://189.175.38.29:4000/api/health`

Debe devolver JSON con `"ready":true` (avisará del certificado autofirmado: Continuar / Avanzado).

Cuando eso funcione, generar APK 4G:

```bat
set API_BASE=https://189.175.38.29:4000
D:\pulsanet\mobile\scripts\BUILD-APK-WHATSAPP.cmd
```

Cert LAN ya incluye SAN `192.168.1.66` y `189.175.38.29` (regenerado 2026-08-22).
