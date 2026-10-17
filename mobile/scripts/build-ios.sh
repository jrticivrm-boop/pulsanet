#!/usr/bin/env bash
# Build IPA SICOM / TacticalPtx (requiere macOS + Xcode 16+ + Apple Developer).
# Uso:
#   cd mobile && ./scripts/build-ios.sh
#   API_BASE=https://pulsanet.duckdns.org ./scripts/build-ios.sh
#   ./scripts/build-ios.sh --no-codesign   # solo comprobar que compila (sin firmar)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NO_CODESIGN=0
for arg in "$@"; do
  case "$arg" in
    --no-codesign) NO_CODESIGN=1 ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: el build iOS solo funciona en macOS con Xcode."
  echo "Desde Windows usa Codemagic (codemagic.yaml) — ver docs/IOS_PENDIENTE_APPLE.md"
  exit 1
fi

if ! command -v flutter >/dev/null 2>&1; then
  echo "ERROR: Flutter no está en PATH."
  exit 1
fi
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "ERROR: Xcode / xcodebuild no encontrado. Instala Xcode desde App Store y acepta la licencia."
  exit 1
fi

API_BASE="${API_BASE:-https://pulsanet.duckdns.org}"
echo "=== SICOM iOS ==="
echo "API_BASE=$API_BASE"
echo "Root=$ROOT"
echo "Xcode: $(xcodebuild -version | head -1)"
flutter --version | head -1

PLIST="ios/Runner/GoogleService-Info.plist"
if [[ ! -f "$PLIST" ]]; then
  echo "AVISO: falta $PLIST (Firebase iOS)."
  echo "  La app compila, pero push FCM en iPhone no funcionará."
  echo "  Copia el plist real (no el .example) o usa GOOGLE_SERVICE_INFO_PLIST_BASE64 en Codemagic."
fi

flutter pub get
cd ios
pod install --repo-update
cd ..

flutter pub run flutter_launcher_icons || true

DEFINES=(--dart-define="API_BASE=$API_BASE")
if [[ -n "${APP_UPDATE_SECRET:-}" ]]; then
  DEFINES+=(--dart-define="APP_UPDATE_SECRET=$APP_UPDATE_SECRET")
fi

if [[ "$NO_CODESIGN" -eq 1 ]]; then
  echo "Compilando sin firma (--no-codesign)…"
  flutter build ios --release --no-codesign "${DEFINES[@]}"
  echo "========== LISTO (sin IPA firmado) =========="
  echo "Para IPA / TestFlight: quita --no-codesign y abre Xcode → Product → Archive,"
  echo "o: flutter build ipa --release \"\${DEFINES[@]}\""
  exit 0
fi

flutter build ipa --release "${DEFINES[@]}" \
  --export-options-plist=ios/ExportOptions-appstore.plist

OUT="build/ios/ipa"
echo "========== LISTO =========="
ls -la "$OUT"/*.ipa 2>/dev/null || ls -la build/ios/archive 2>/dev/null || true
echo "Siguiente: Xcode Organizer → Distribute App → App Store Connect / TestFlight,"
echo "o sube el .ipa con Transporter / Codemagic."
echo "Copia de soporte: C:/pulsanet_soporte/iOS/ (crear si no existe)."
