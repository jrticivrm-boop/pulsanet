# Activar Firebase (FCM) — pasos manuales

El login por terminal falló (`No se pudo verificar al cliente`). Hazlo desde el navegador.

## 1. Crear proyecto

1. Abre: https://console.firebase.google.com
2. Inicia sesión con tu cuenta Google.
3. **Agregar proyecto** → nombre: **TacticalPtx**
4. Puedes desactivar Google Analytics (no hace falta para push).
5. Crea el proyecto y entra.

Anota el **ID del proyecto** (algo como `tacticalptx-xxxxx`).

## 2. App Android

1. En el proyecto → ícono **Android**.
2. Nombre del paquete (obligatorio):

 `com.tacticalptx.app`

3. Alias de la app: `TacticalPtx`
4. Registrar app.
5. Descarga **`google-services.json`**.
6. Copia ese archivo aquí (reemplaza si ya existe):

 `D:\pulsanet\mobile\android\app\google-services.json`

## 3. Clave del servidor (para la API)

1. Ícono de engranaje → **Configuración del proyecto**.
2. Pestaña **Cuentas de servicio**.
3. **Generar nueva clave privada** → descarga el JSON.
4. Guárdalo como:

 `D:\Soporte\Secrets\tacticalptx-firebase-adminsdk.json`

 (no lo subas a Git).

## 4. Avisarme

Cuando existan esos **2 archivos**, escribe en el chat: **listo**.

Yo conectaré el backend, reiniciaré la API y comprobaré que diga FCM encendido.
