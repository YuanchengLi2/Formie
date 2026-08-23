#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
derived_data="${RUNNER_TEMP:-$repo_root/.codex-tmp}/formie-ios-runtime-smoke"
runtime_stdout="${RUNNER_TEMP:-$repo_root/.codex-tmp}/formie-runtime.stdout.log"
runtime_stderr="${RUNNER_TEMP:-$repo_root/.codex-tmp}/formie-runtime.stderr.log"

cd "$repo_root"
npx expo prebuild --platform ios --clean --no-install
(cd ios && pod install)

workspace="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
if [[ -z "$workspace" ]]; then
  echo "No generated Xcode workspace was found." >&2
  exit 1
fi

scheme="Formie"
simulator_udid="$(xcrun simctl list devices available -j | python3 -c 'import json,sys; data=json.load(sys.stdin); devices=[d for group in data["devices"].values() for d in group if d.get("isAvailable") and d.get("deviceTypeIdentifier", "").startswith("com.apple.CoreSimulator.SimDeviceType.iPhone")]; print(devices[0]["udid"])')"

xcrun simctl boot "$simulator_udid" 2>/dev/null || true
xcrun simctl bootstatus "$simulator_udid" -b

xcodebuild \
  -workspace "$workspace" \
  -scheme "$scheme" \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "id=$simulator_udid" \
  -derivedDataPath "$derived_data" \
  CODE_SIGNING_ALLOWED=NO \
  build

app_path="$(find "$derived_data/Build/Products/Release-iphonesimulator" -maxdepth 1 -name '*.app' -print -quit)"
if [[ -z "$app_path" ]]; then
  echo "The simulator app bundle was not produced." >&2
  exit 1
fi

xcrun simctl install "$simulator_udid" "$app_path"
launch_output="$(xcrun simctl launch --terminate-running-process --stdout="$runtime_stdout" --stderr="$runtime_stderr" "$simulator_udid" app.form.coach)"
echo "$launch_output"
app_pid="${launch_output##*: }"
wait_seconds="${FORMIE_RUNTIME_SMOKE_WAIT_SECONDS:-15}"
sleep "$wait_seconds"

if [[ "$app_pid" =~ ^[0-9]+$ ]] && kill -0 "$app_pid" 2>/dev/null; then
  echo "Formie remained alive for $wait_seconds seconds after release launch (pid $app_pid)."
  exit 0
fi

echo "Formie terminated during release launch." >&2
echo "--- stdout ---"
test -f "$runtime_stdout" && sed -n '1,240p' "$runtime_stdout" || true
echo "--- stderr ---"
test -f "$runtime_stderr" && sed -n '1,240p' "$runtime_stderr" || true
echo "--- unified device log ---"
xcrun simctl spawn "$simulator_udid" log show --last 3m --style compact --predicate 'process == "Formie" OR senderImagePath CONTAINS "Formie"' || true
echo "--- crash reports ---"
find "$HOME/Library/Logs/DiagnosticReports" "$HOME/Library/Developer/CoreSimulator/Devices/$simulator_udid/data/Library/Logs/CrashReporter" -type f \( -name 'Formie*.crash' -o -name 'Formie*.ips' \) -mmin -10 -print -exec sed -n '1,320p' {} \; 2>/dev/null || true
exit 1
