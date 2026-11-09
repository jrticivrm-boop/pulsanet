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
- [ ] Si el cambio necesita APK nueva: se compila aparte (solo cuando se pida) y se prueba antes de distribuirla. **Lista para distribuir:** `SICOM-1.8.194+204.apk` en `C:\pulsanet_soporte\APK\` (sesión 15 min + keepalive, inbox por último mensaje, FLAG_SECURE). Instalar sobre la 1.8.193+203: login, radio, mapa y que la sesión no se caiga a los 15 min.

## Si toca autenticación / seguridad

- [ ] Login web y APK con usuario normal; la consola 24 h no se cierra sola (el keepalive renueva el JWT de 15 min).
- [ ] «Salir» cierra la sesión también en el servidor: el refresh ya no sirve en otra pestaña.
- [ ] Usuario con contraseña temporal: no entra a radio/mapa hasta cambiarla (API responde `MUST_CHANGE_PASSWORD`).
- [ ] Bloquear un usuario (3 contraseñas malas): deja de valer el JWT al momento (mapa/radio se cortan); un admin lo desbloquea.
- [ ] Forzar cierre de sesión desde Usuarios: la consola/APK de esa cuenta sale.
- [ ] Root también se bloquea por intentos; hace falta otro admin para liberarlo.
- [ ] Migración `051_token_version.sql` aplicada (`-Migrate` en producción).

## Si toca Territorio / catálogo de cobertura

- [ ] Consola → Territorio: solo 2 selects (Región/Zona/Unidad y Estado/Municipio) + Colores; sin Limpiar, Encuadrar ni Usuarios.
- [ ] Región/Zona/Unidad: aparece IV R.M. (u otras) solo si tienen municipios en Configuración → Territorio; check de región/zona marca hijos; el mapa filtra al marcar.
- [ ] Mapa: Tampico, Ciudad Madero y el resto de Tamaulipas y San Luis del 15/o. B.I. (y las demás unidades) se pintan si el estado y la unidad están elegidos. Aldama y Tampico, mismo color.
- [ ] Estado/Municipio: estados plegables con municipios; Abasolo Tamps. vs Abasolo N.L. en grupos distintos; el check del estado marca el grupo.
- [ ] Configuración → Territorio: árbol Región→Zona→Unidad plegable (PRUEBA_ZONA bajo su región de Dependencias); búsqueda en el árbol; contadores; unidades (0) en gris «sin municipios». Ya no está en Catálogos.
- [ ] El 15/o. B.I. solo aparece en 48/a. Z.M., igual que en Catálogos → Dependencias. En 8/a. Z.M. no está. Al abrirlo, Tamaulipas muestra sus municipios marcados (Tampico, Ciudad Madero, Aldama).
- [ ] Al marcar/desmarcar municipios aparece el resumen arriba del panel. Ya no está «Marcar visibles».
- [ ] Estado con municipios de esa unidad muestra el número (`Tamaulipas · 1`). Un estado en cero muestra solo el nombre.
- [ ] Municipio de otra unidad: el nombre va en gris y el clic en el nombre no hace nada. El check pregunta «¿Sustituirlo?». Aceptar lo mueve y la otra unidad lo pierde. Cancelar lo deja. Quitar un check no lo devuelve.
- [ ] Bolita / «Color en mapa»: cambia el relleno en Consola → Territorio (mapa). Misma unidad en dos zonas: se ve `zona|unidad` y colores independientes.
- [ ] Pliegues del árbol se recuerdan al recargar (por usuario, no solo este navegador).
- [ ] Región distinta de IV: banner de que aún no hay polígonos GeoJSON; la asignación igual se guarda.
- [ ] Migración `052` + `053_territory_ui_prefs_colors.sql` aplicadas (`-Migrate` en producción).

## Si hay migraciones de BD

- [ ] `PRUEBAS.ps1` las aplicó sin error sobre la copia de producción.
- [ ] La consola funciona después de migrar (secciones afectadas).
- [ ] Subir con `-Migrate` (respalda la BD de producción antes).

## Momento de subir

- [ ] Dentro de la ventana 21:00–07:00, o avisando a los usuarios si es urgente (PTT/video se cortan unos segundos).
- [ ] VERIFICAR-PRUEBAS dice **listo para subir**.
- [ ] Después de subir: iniciar sesión en `https://192.168.1.150` y revisar la sección cambiada. Si algo falla: `.\infra\REVERTIR-PRODUCCION.ps1`.
