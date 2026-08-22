#!/usr/bin/env bash
set -euo pipefail

npx expo prebuild --platform ios --no-install
(
  cd ios
  pod install
)

DERIVED_DATA_PATH="${RUNNER_TEMP}/FormieDerivedData"
xcodebuild \
  -workspace ios/Formie.xcworkspace \
  -scheme Formie \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=${SIMULATOR_UDID}" \
  -derivedDataPath "${DERIVED_DATA_PATH}" \
  ONLY_ACTIVE_ARCH=YES \
  ARCHS=arm64 \
  CODE_SIGNING_ALLOWED=NO \
  build

APP_PATH="${DERIVED_DATA_PATH}/Build/Products/Release-iphonesimulator/Formie.app"
test -d "${APP_PATH}"
xcrun simctl install "${SIMULATOR_UDID}" "${APP_PATH}"
