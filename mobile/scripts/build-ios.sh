#!/usr/bin/env bash
# Build IPA TacticalPtx (requiere macOS + Xcode + Apple Developer).
# Uso:
#   cd mobile && ./scripts/build-ios.sh
#   API_BASE=https://TU_DOMINIO.sslip.io ./scripts/build-ios.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: el build iOS solo funciona en macOS con Xcode."
  exit 1
fi

if [[ -z "${API_BASE:-}" ]] && [[ -f ../backend/.env ]]; then
  dom="$(grep -m1 '^PUBLIC_DOMAIN=' ../backend/.env | cut -d= -f2- | tr -d "\"'")"
  if [[ -n "$dom" ]]; then API_BASE="https://$dom"; fi
fi
API_BASE="${API_BASE:-https://189.152.222.98.sslip.io}"
echo "=== TacticalPtx iOS ==="
echo "API_BASE=$API_BASE"
echo "Root=$ROOT"

if [[ ! -f ios/Runner/GoogleService-Info.plist ]]; then
  echo "AVISO: falta ios/Runner/GoogleService-Info.plist (Firebase iOS)."
  echo "  Sin ese archivo la app corre, pero push FCM en iOS no funcionará."
fi

flutter pub get
cd ios
pod install --repo-update
cd ..

# Iconos iOS (si flutter_launcher_icons está configurado)
flutter pub run flutter_launcher_icons || true

DEFINES=(--dart-define="API_BASE=$API_BASE")
if [[ -n "${APP_UPDATE_SECRET:-}" ]]; then
  DEFINES+=(--dart-define="APP_UPDATE_SECRET=$APP_UPDATE_SECRET")
fi

flutter build ipa --release "${DEFINES[@]}"

OUT="build/ios/ipa"
echo "========== LISTO =========="
ls -la "$OUT"/*.ipa 2>/dev/null || ls -la build/ios/archive 2>/dev/null || true
echo "Abre el .ipa / Organizer en Xcode → Distribute (TestFlight o Ad Hoc)."
echo "Copia de soporte: Soporte/APK/ no aplica a iOS; usa Soporte/iOS/ si existe."
