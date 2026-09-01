# TacticalPtx — App iOS

**Bundle:** `com.tacticalptx.app`

## Guías

| Documento | Uso |
|-----------|-----|
| [IOS_BUILD_MAC_TAHOE.md](../Soporte/Documentos/IOS_BUILD_MAC_TAHOE.md) | Build **local** en Mac con **Tahoe 26.x** (recomendado) |
| [IOS_BUILD_MAC_MONTEREY.md](../Soporte/Documentos/IOS_BUILD_MAC_MONTEREY.md) | Solo si aún estás en Monterey 12.x (Xcode 14.2) |
| [IOS_TESTFLIGHT_CHECKLIST.md](../Soporte/Documentos/IOS_TESTFLIGHT_CHECKLIST.md) | TestFlight + Codemagic (CI) |

## Resumen

- **Mac Tahoe:** Xcode App Store + Flutter + CocoaPods → `flutter run` e IPA local.  
- **Codemagic:** opcional / CI desde Windows (`codemagic.yaml`).  
- Firebase: `mobile/ios/Runner/GoogleService-Info.plist` (no en git).  
- Script: `mobile/scripts/build-ios.sh`
