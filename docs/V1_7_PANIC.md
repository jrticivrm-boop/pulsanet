# TacticalPtx v1.7 — Botón de pánico

## Qué hace

Desde la **app móvil** o **Radio web** (canal activo), el operador pulsa **PÁNICO**.

Se notifica **únicamente a los miembros de ese grupo/canal**. No se escala al resto de la organización (ni a admins/despacho fuera del grupo, ni a usuarios con `canReceivePanic` que no sean miembros).

## Canales de alerta

- Mensaje de sistema en el chat del grupo (`🚨 PÁNICO — …`)
- Socket `panic:alert` al room `group:{id}`
- Socket `dispatch:panic` solo a salas `user:{id}` de miembros del mismo grupo (consola de despacho)
- Push FCM (`type=panic`) solo a dispositivos de miembros del grupo
- **Sonido de alarma** en bucle hasta **Enterado** / **Resolver**

## Enterado / Resolver

- Solo miembros del mismo grupo pueden ver, acusar o resolver la alerta.
- En **Radio web**: banner rojo + **Enterado**.
- En **Despacho**: modal si el operador de consola es miembro del grupo del pánico.
- En **móvil**: diálogo + alarma hasta **Enterado**.
- **Enterado** silencia en el dispositivo local; **Resolver** / **Cancelar** avisa al resto del grupo.

## API

| Método | Ruta | Quién |
|--------|------|--------|
| `POST` | `/api/panic` `{ groupId, latitude?, longitude? }` | Miembro del canal |
| `GET` | `/api/panic?status=active` | Autenticado; solo eventos de grupos donde es miembro |
| `PATCH` | `/api/panic/:id` `{ status: acked\|resolved\|cancelled }` | Miembro del mismo grupo |

## Admin

- La columna **Recibe pánico** (`canReceivePanic`) ya no escala alertas fuera del grupo; el alcance lo define la membresía en `group_members`.

## Migración

`database/migrations/009_panic_button.sql`
