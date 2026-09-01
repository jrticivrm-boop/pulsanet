# TacticalPtx — Manual de usuario (v1.0)

## Qué es TacticalPtx

Comunicación **Push-to-Talk (PTT)** por internet: habla en grupos como un radio, con chat, presencia y mapa de despacho.

---

## Acceso

El ingreso es con **usuario** y **contraseña**.

- El usuario se genera del nombre: inicial + apellido paterno + inicial materno + número (ej. Guadalupe Gómez de la Cruz → `ggomezd2`).
- El administrador crea usuarios en **Despacho → Usuarios**.
- En el primer ingreso, el usuario debe cambiar la contraseña temporal.
- Arranque técnico (solo un root): en el servidor, `cd backend && npm run seed`.

---

## Web — Radio (operadores)

1. Abre el panel web (local: http://localhost:5173 o el dominio de producción).
2. Inicia sesión con tu **usuario** corporativo.
3. Elige el canal **General** (u otro asignado).
4. Mantén **PTT** (o Espacio) para hablar; suelta para liberar.
5. Si otro habla, verás “ocupado” / denegado.
6. Usa el chat del canal para texto.

## Web — Despacho

1. Entra con una cuenta **root**, **admin** o **despacho**.
2. Ve a **Despacho**: overview (online, speakers), mapa, usuarios y grupos.
3. Admin/root puede crear usuarios, asignar grupos y restablecer claves temporales.

## App Android

1. Instala el APK/AAB de la organización.
2. Inicia sesión con tu usuario.
3. Selecciona grupo → PTT grande → chat.
4. Conéctate a la misma Wi‑Fi/VPN que el servidor; el API debe ser alcanzable (no uses `127.0.0.1` en el teléfono).

---

## Buenas prácticas

- Un hablante a la vez por canal.
- Suelta el PTT al terminar (libera el floor).
- Si pierdes red, espera a reconectar (< ~10 s objetivo) y vuelve a unirte al canal.
- No compartas contraseñas; el admin puede desactivar cuentas.

---

## Soporte

Contacta al administrador de tu organización. Documentación técnica: [PRODUCCION_MES6.md](PRODUCCION_MES6.md).
