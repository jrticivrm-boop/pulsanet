# TacticalPtx — Web (radio + despacho)

- **Radio PTT:** `/radio` (Mes 1–2)
- **Despacho:** `/despacho` (Mes 4) — admin/dispatcher

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Con certs en `infra/certs/`, Vite escucha **HTTPS** en `:5173` (mismo PEM que la API).

- Local: `https://127.0.0.1:5173` (aceptar cert autofirmado)
- Remoto / 4G: `https://IP_PUBLICA:5173` — **no** uses `http://` o el PTT falla (`mediaDevices` undefined)

Ver [docs/DESPACHO_MES4.md](../docs/DESPACHO_MES4.md) y `Soporte/Documentos/ACCESO_DIRECTO_SIN_TAILSCALE.md`.

Stack: React + Vite + Socket.IO + LiveKit + Leaflet/OSM + React Router
