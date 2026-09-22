# Checklist — copiar SICOM/TacticalPtx a otra PC (3 paquetes)

Fecha de referencia: 2026-09-16.  
Guía larga: `C:\pulsanet\docs\INSTALAR_OTRA_MAQUINA.md`.  
Inventario automático: `powershell -File C:\pulsanet\infra\Inventario-Migracion.ps1`.

## Las 3 cosas a copiar

| # | Qué | Ruta origen | Notas |
|---|-----|-------------|--------|
| **1** | Producto completo | `C:\pulsanet` | **No** solo `git clone`. Incluye `.env`, uploads, secrets, keystore. |
| **2** | Auxiliar / soporte | `C:\pulsanet_soporte` | APK, Documentos, Respaldos, Logs, Brand. |
| **3** | Respaldo fresco BD+media | `C:\pulsanet\backend\data\backups\tacticalptx_*.zip` (el más reciente) | O genera uno nuevo en Panel → Config → Respaldos. |

Opcional 4º: `C:\pulsanet-dev` solo si trabajas el árbol DEV.

## Dentro de `C:\pulsanet` — verificar ANTES de copiar

Estos suelen **no** ir en git (`.gitignore`) y si faltan la otra PC no arranca igual:

| Archivo / carpeta | ¿Para qué? |
|-------------------|------------|
| `backend\.env` | JWT, cifrado chat, LiveKit, DuckDNS, Firebase embebido |
| `infra\secrets\tacticalptx-firebase-adminsdk.json` | Push FCM (Admin SDK) |
| `mobile\android\app\google-services.json` | Push en la APK |
| `mobile\android\upload-keystore.jks` | Firmar APK igual que siempre |
| `mobile\android\key.properties` | Ruta/alias del keystore |
| `infra\certs\*.pem` | HTTPS LAN (Vite/API) |
| `backend\uploads\` | Multimedia (si no restauras ZIP) |
| `infra\caddy\caddy.exe` + `data\` | Borde público |
| `infra\livekit\livekit-server.exe` | PTT |
| `.cursor\rules\` | Anti-regresión / bitácora / APK |

## En la PC destino — software

1. Windows 10/11  
2. Node.js LTS 18+  
3. PostgreSQL 15–18 (`:5432`)  
4. Redis (`:6379`)  
5. Git (recomendado)  
6. Flutter + Android SDK **solo** si vas a compilar APK  

## Puesta en marcha (resumen)

```bat
:: Carpetas en C:\pulsanet y C:\pulsanet_soporte
CREAR-O-ACTUALIZAR-BD.bat
LEVANTAR-TACTICALPTX.bat
:: Web https://127.0.0.1:5173 → Config → Respaldos → subir ZIP → RESTAURAR
:: Reiniciar ventanas API/Web
```

**Importante:** copia el mismo `backend\.env`. Si regeneras `CONTENT_ENCRYPTION_KEY`, el chat viejo no se lee.

## Prompt para Cursor en la otra máquina

Abre y pega: `C:\pulsanet_soporte\Documentos\PROMPT_AGENTE_OTRA_MAQUINA.md`

## Pendiente de red (no se “copia”)

El 4G (`pulsanet.duckdns.org`) depende del **modem Telmex + Deco** (doble NAT). En la PC nueva tendrás que:

- abrir TCP 80/443 hacia la LAN del host, o  
- bridge del modem + UPnP Deco, o  
- usar Wi‑Fi LAN: en la APK «Servidor» → `https://IP-LAN:4000` / borde LAN.

## Qué NO hace falta copiar

- `node_modules` / `.dart_tool` / `build` (se regeneran; si copias todo el árbol también sirve, solo pesa más)  
- Emuladores Android  
- Secretos en texto plano sueltos fuera de `.env` / `infra\secrets`
