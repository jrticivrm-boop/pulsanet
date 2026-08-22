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
3. Firewall Windows: puertos **4000** (API), **7880–7882** (LiveKit).
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
| 4000 | 4000 | TCP | API + Socket.IO |
| 7880 | 7880 | TCP | LiveKit señal |
| 7881 | 7881 | TCP | LiveKit RTC TCP |
| 7882 | 7882 | UDP | LiveKit RTC media |

Si el router solo permite TCP, prueba igual; el audio WebRTC puede degradar o fallar sin UDP **7882**.

### 3) APK apuntando a la IP pública (sin dominio)

```bat
set API_BASE=http://TU.IP.PUBLICA:4000
D:\pulsanet\mobile\scripts\BUILD-APK-WHATSAPP.cmd
```

Ejemplo: `http://187.190.x.x:4000`

### 4) LiveKit / ICE

Con `LIVEKIT_PUBLIC_URL` vacío, el API ya reescribe la URL LiveKit con el **host con el que el cliente llegó**. Si el celular usa `http://IP_PUBLICA:4000`, LiveKit debería anunciarse como `ws://IP_PUBLICA:7880`.

Si el audio no llega desde 4G:
1. Confirma UDP 7882 abierto de verdad (muchos routers lo bloquean).
2. En `.env` puedes forzar (solo si hace falta):

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
