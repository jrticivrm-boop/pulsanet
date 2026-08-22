# TacticalPtx — pruebas 4G / 5G (Tailscale)

La app en datos móviles **no ve** `192.168.1.66`. Se usa Tailscale (VPN) para que el teléfono y la PC estén en la misma red.

## En esta PC (ya hecho)

- Tailscale instalado y conectado
- IP de la PC: **100.127.12.44**
- API: `http://100.127.12.44:4000`
- LiveKit ICE: esa misma IP

## En el teléfono

1. Instala **Tailscale** (Play Store).
2. Inicia sesión con la **misma cuenta** que la PC (`jr.tic.ivrm@…`).
3. Deja Tailscale **conectado** (también en 4G).
4. Instala el APK compilado con `API_BASE=http://100.127.12.44:4000`.
5. En la PC: `LEVANTAR-TACTICALPTX.bat` (Postgres + API + LiveKit).

## Comprobar

- En el teléfono (con Tailscale on), el navegador: `http://100.127.12.44:4000/api/health` debe responder `ok`.
- Luego abre TacticalPtx: login, PTT, chat.

## Notas

- Sin Tailscale en el celular, 4G no llega al servidor de la oficina.
- Cloudflare de `encuestasivrm.uk` no es este puente.
- La IP `100.x` puede cambiar si se reinstala Tailscale; entonces hay que recompilar el APK.
