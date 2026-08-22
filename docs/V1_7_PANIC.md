# PulsaNet v1.7 — Botón de pánico

## Qué hace

Desde la **app móvil** o **Radio web** (canal activo), el operador pulsa **PÁNICO** (confirmación).

Se notifica a:

1. **Todos los miembros del grupo/canal**
2. **Admin y despachadores** de la organización (aunque no estén en el canal)
3. **Usuarios con permiso** `canReceivePanic` (otorgado por admin en Despacho → Usuarios)

## Canales de alerta

- Mensaje de sistema en el chat del grupo (`🚨 PÁNICO — …` + coords si hay GPS)
- Socket `panic:alert` al grupo + `dispatch:panic` a la consola
- Push FCM (`type=panic`) si Firebase está activo
- **Sonido de alarma** en bucle (Radio/Despacho web y app móvil) **hasta que un operador pulse Enterado** (o Resolver en Despacho)

## Enterado

- En **Radio web**: banner rojo + botón **Enterado** (miembros del canal).
- En **Despacho**: banner de pánicos activos → **Enterado** / **Resolver**.
- En **móvil**: diálogo modal + alarma repetida hasta **Enterado**.
- Un Enterado notifica al resto (`panic:update` / `dispatch:panic_update`) y silencia en todos los clientes del canal.

## API

| Método | Ruta | Quién |
|--------|------|--------|
| `POST` | `/api/panic` `{ groupId, latitude?, longitude? }` | Miembro del canal |
| `GET` | `/api/panic?status=active` | Admin / dispatcher / `canReceivePanic` |
| `PATCH` | `/api/panic/:id` `{ status: acked\|resolved\|cancelled }` | Admin/dispatcher/`canReceivePanic`; miembros del canal solo `acked` |

## Admin

- Columna **Recibe pánico** en Usuarios
- Botón **Dar pánico / Quitar pánico** (solo operators; admin/dispatcher ya reciben por rol)

## Migración

`database/migrations/009_panic_button.sql`
