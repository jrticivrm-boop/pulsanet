# Seguridad TacticalPtx — lockdown ante intrusión

## Qué hace

1. **Detecta** muchos fallos de login (por IP o usuario) en una ventana de tiempo.
2. **Activa lockdown**: la API responde `503`, corta sockets, revoca todos los refresh tokens.
3. **Avisa** a root/admin por FCM (si está configurado).
4. **Guarda** un incidente en `Soporte/Respaldos/incident-*` (sin secretos).
5. **Opcional (host):** `infra/LOCKDOWN.ps1` cierra firewall TacticalPtx, UPnP y detiene API/Web/LiveKit.

## Endpoints

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/security/status` | ¿Hay lockdown? |
| POST | `/api/security/unlock` | `{ "unlockSecret": "..." }` — desbloqueo de emergencia |
| POST | `/api/security/lockdown` | Root JWT + `{ "confirm": true, "reason": "..." }` |

## Variables (`.env`)

```
INTRUSION_MAX_FAIL_IP=12
INTRUSION_MAX_FAIL_USER=8
INTRUSION_FAIL_WINDOW_SEC=600
LOCKDOWN_UNLOCK_SECRET=...   # ≥16 caracteres
SECURITY_ALERT_USER_IDS=     # opcional, UUIDs
ALLOW_HOST_LOCKDOWN=0        # 1 = la API lanza LOCKDOWN.ps1
```

## Host

```bat
D:\pulsanet\infra\LOCKDOWN.cmd
```

Tras el incidente: desbloquear API → `LEVANTAR-TACTICALPTX.bat` → `infra\ENSURE-FIREWALL.cmd`.

## Auditoría realizada

- No se encontraron backdoors, shells remotos ni webhooks de exfiltración en el código.
- `/api/metrics` ahora exige sesión de despacho (ya no es público).
- Health en lockdown responde fuera de servicio (`503`).
- Flags en `backend/data/` (gitignored).
