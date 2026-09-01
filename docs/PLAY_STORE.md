# Play Store — qué falta (cuenta + keystore)

## Keystore (YA hecho en esta PC)

Firma de la app para que Google Play acepte actualizaciones siempre con la **misma** clave.

| Archivo | Ubicación |
|---------|-----------|
| Trabajo | `D:\pulsanet\mobile\android\upload-keystore.jks` + `key.properties` |
| **Respaldo** | `D:\Soporte\Respaldos\keystore_*\` |

Sin el `.jks` no puedes subir una versión nueva de la misma app. Guárdalo en USB/nube privada; **no** lo subas a Git.

AAB listo (cuando lo generamos): 
`D:\pulsanet\mobile\build\app\outputs\bundle\release\app-release.aab`

## Cuenta Play (LO TIENES QUE HACER TÚ)

Yo no puedo crear tu cuenta de Google Play: pide identidad, tarjeta y pago único (~25 USD).

1. Entra a https://play.google.com/console con tu Google 
2. Paga la cuota de desarrollador 
3. Crear app → id `com.tacticalptx.app` 
4. Completa ficha, privacidad ([docs/PRIVACY.md](PRIVACY.md) hospedada en una URL pública) 
5. Sube el `.aab` a pista **interna** o **cerrada** 
6. Prueba → producción 

## Rebuild AAB si cambias código

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
cd D:\pulsanet\mobile
flutter build appbundle --release --dart-define=API_BASE=https://TU-DOMINIO-API
```
