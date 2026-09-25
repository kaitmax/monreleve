#!/usr/bin/env bash
# android/scripts/screenshot.sh - adb exec-out screencap, with the device
# serial asserted and the output verified non-empty (R233: a measurement
# reports whether it observed its subject; a 0-byte PNG must fail, not pass).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="$(grep '^sdk.dir=' "$ANDROID_DIR/local.properties" | cut -d= -f2-)"
ADB_BIN="$SDK_DIR/platform-tools/adb.exe"

OUTPUT_PATH="${1:?usage: $0 <output-path.png>}"

fail() {
  echo "SCREENSHOT SCRIPT FAILED: $1" >&2
  exit 1
}

[ -f "$ADB_BIN" ] || fail "adb binary not found at $ADB_BIN"

DEVICE_COUNT="$("$ADB_BIN" devices | grep -c '^emulator-' || true)"
if [ "$DEVICE_COUNT" -ne 1 ]; then
  fail "expected exactly 1 emulator device visible to adb, found $DEVICE_COUNT"
fi
SERIAL="$("$ADB_BIN" devices | grep '^emulator-' | head -1 | cut -f1)"

echo "capturing from $SERIAL..."
"$ADB_BIN" -s "$SERIAL" exec-out screencap -p > "$OUTPUT_PATH"

SIZE="$(stat -c%s "$OUTPUT_PATH" 2>/dev/null || stat -f%z "$OUTPUT_PATH" 2>/dev/null || echo 0)"
if [ "$SIZE" -eq 0 ]; then
  fail "captured file $OUTPUT_PATH is empty (0 bytes) - the measurement did not observe its subject"
fi

echo "OK: $OUTPUT_PATH ($SIZE bytes)"
