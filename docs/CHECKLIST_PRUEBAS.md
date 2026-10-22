# Lista de verificación antes de subir a producción

Se revisa en **pruebas** (`https://localhost:5180`, copia de la BD de producción, sin notificaciones push) **antes** de `.\infra\PROMOVER.ps1 -A produccion`.

La parte automática la hace `.\infra\VERIFICAR-PRUEBAS.ps1` (también la corre PROMOVER): que pruebas ejecute exactamente el código que se va a subir, API/web arriba, sintaxis del backend, migraciones, estado de producción y usuarios conectados.

Esta lista es la parte **manual**. Revisa siempre la sección *Base* y, además, las secciones que tocan los cambios.

## Preparación

- [ ] `.\infra\PROMOVER.ps1 -A pruebas` y `.\infra\PRUEBAS.ps1` (con `-RefrescarBD` si la copia tiene más de 7 días o el cambio toca datos).
- [ ] Leer la lista de commits que muestra PROMOVER: saber qué cambió.

## Base (siempre)

- [ ] Iniciar sesión con un administrador; la consola carga sin errores.
- [ ] Mapa: se ven unidades/usuarios con su última ubicación.
- [ ] Canales: la lista abre; entrar a un canal y ver el historial.
- [ ] Mensaje de texto en un canal: se envía y aparece.
- [ ] Usuarios: la lista abre y el detalle de un usuario carga.
- [ ] Sin errores rojos en la ventana `PRUEBAS API :4200`.

## Si el cambio toca voz / radio (PTT)

- [ ] Entrar a la radio de un canal desde la consola; transmitir y recibir (dos navegadores o navegador + otra PC).
- [ ] PTT múltiple: escuchar dos canales a la vez.
- [ ] La grabación aparece en el historial del canal.

## Si toca video

- [ ] Abrir video de un usuario/canal; imagen y audio llegan.
- [ ] Cerrar y reabrir sin quedar colgado.

## Si toca pánico / avisos

- [ ] Disparar un pánico de prueba y verlo en la consola; atenderlo y cerrarlo.
- [ ] Crear un aviso y verlo publicado.

## Si toca usuarios, perfiles o estructura

- [ ] Crear un usuario de prueba con el perfil afectado; la contraseña temporal funciona.
- [ ] Iniciar sesión con ese usuario y comprobar lo que ve (canales, mapa, módulos) según su alcance.
- [ ] Borrar/desactivar el usuario de prueba al terminar.

## Si toca la app móvil

- [ ] Los cambios del servidor no rompen a la APK instalada (misma API): iniciar sesión desde un teléfono de prueba contra pruebas (Wi-Fi; en inicio de sesión → *Servidor*: `https://192.168.1.77:4200`; al terminar, borrarlo) y revisar mapa/canales/mensajes. Voz y video del teléfono se validan con una cuenta de prueba justo después de subir.
- [ ] Si el cambio necesita APK nueva: se compila aparte (solo cuando se pida) y se prueba antes de distribuirla.

## Si toca autenticación / seguridad

- [ ] Login web y APK con usuario normal; la consola 24 h no se cierra sola (el keepalive renueva el JWT de 15 min).
- [ ] «Salir» cierra la sesión también en el servidor: el refresh ya no sirve en otra pestaña.
- [ ] Usuario con contraseña temporal: no entra a radio/mapa hasta cambiarla (API responde `MUST_CHANGE_PASSWORD`).
- [ ] Bloquear un usuario (3 contraseñas malas): deja de valer el JWT al momento (mapa/radio se cortan); un admin lo desbloquea.
- [ ] Forzar cierre de sesión desde Usuarios: la consola/APK de esa cuenta sale.
- [ ] Root también se bloquea por intentos; hace falta otro admin para liberarlo.
- [ ] Migración `051_token_version.sql` aplicada (`-Migrate` en producción).

## Si toca Territorio / catálogo de cobertura

- [ ] Consola → Territorio: aparece Estado entre Unidad y Municipio; al marcar Tamaulipas solo salen sus municipios, agrupados (Abasolo Tamps. vs Abasolo N.L. en grupos distintos). En Municipio cada estado se pliega (▸) con sus municipios; el check del encabezado marca el grupo; Descendente no mueve el orden de estados.
- [ ] Catálogos → Territorio: elegir una unidad, un estado, marcar/desmarcar municipios; no hay alta ni baja de estados.
- [ ] Tras guardar, el mapa pinta la unidad en esos municipios (sin recargar a mano si la consola sigue abierta).
- [ ] Migración `052_territory_coverage.sql` aplicada (`-Migrate` en producción).

## Si hay migraciones de BD

- [ ] `PRUEBAS.ps1` las aplicó sin error sobre la copia de producción.
- [ ] La consola funciona después de migrar (secciones afectadas).
- [ ] Subir con `-Migrate` (respalda la BD de producción antes).

## Momento de subir

- [ ] Dentro de la ventana 21:00–07:00, o avisando a los usuarios si es urgente (PTT/video se cortan unos segundos).
- [ ] VERIFICAR-PRUEBAS dice **listo para subir**.
- [ ] Después de subir: iniciar sesión en `https://192.168.1.150` y revisar la sección cambiada. Si algo falla: `.\infra\REVERTIR-PRODUCCION.ps1`.
