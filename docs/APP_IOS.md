# TacticalPtx / SICOM — App iOS

**Bundle:** `com.tacticalptx.app` · **Display name:** SICOM

## Estado

El proyecto está **preparado para compilar**. Falta solo:

1. Cuenta **Apple Developer** + app en App Store Connect  
2. `GoogleService-Info.plist` + llave **APNs** en Firebase  
3. Lanzar **Codemagic** o `mobile/scripts/build-ios.sh` en Mac con **Xcode 16+**

Detalle: [`IOS_PENDIENTE_APPLE.md`](IOS_PENDIENTE_APPLE.md).

## Guías

| Documento | Uso |
|-----------|-----|
| [`IOS_PENDIENTE_APPLE.md`](IOS_PENDIENTE_APPLE.md) | Qué falta (Apple) y qué ya está en el repo |
| `C:\pulsanet_soporte\Documentos\IOS_TESTFLIGHT_CHECKLIST.md` | Codemagic → TestFlight |
| `C:\pulsanet_soporte\Documentos\IOS_BUILD_MAC.md` | Build local en Mac (Xcode 16+) |

## Resumen técnico

- **Codemagic:** `codemagic.yaml` (workflows TestFlight y solo IPA).  
- **Mac:** `mobile/scripts/build-ios.sh` → `API_BASE=https://pulsanet.duckdns.org`.  
- **Firebase:** `mobile/ios/Runner/GoogleService-Info.plist` (gitignored); plantilla `.example`.  
- **iOS mínimo:** 13.0 (`Podfile`).  
- **Canales nativos Android:** no se invocan en iOS (`lib/android_native.dart`).  
- **IPA de soporte:** `C:\pulsanet_soporte\iOS\`.
