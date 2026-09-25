#!/usr/bin/env bash
# android/scripts/walkthrough.sh - installs the debug APK, launches
# MainActivity, and captures a screenshot via screenshot.sh. This produces
# the PNG the session must OPEN and describe (AC1/AC2) - a harness that
# produces an image nobody looked at is not the instrument.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="$(grep '^sdk.dir=' "$ANDROID_DIR/local.properties" | cut -d= -f2-)"
ADB_BIN="$SDK_DIR/platform-tools/adb.exe"

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE="ch.monreleve.app"
ACTIVITY="ch.monreleve.app.MainActivity"
OUTPUT_PATH="${1:-$ANDROID_DIR/.walkthrough-aujourdhui.png}"

fail() {
  echo "WALKTHROUGH SCRIPT FAILED: $1" >&2
  exit 1
}

[ -f "$ADB_BIN" ] || fail "adb binary not found at $ADB_BIN"
[ -f "$APK_PATH" ] || fail "debug APK not found at $APK_PATH - run './gradlew assembleDebug' first"

echo "installing $APK_PATH..."
"$ADB_BIN" install -r "$APK_PATH" || fail "adb install failed"

echo "launching $PACKAGE/$ACTIVITY..."
"$ADB_BIN" logcat -c
"$ADB_BIN" shell am start -n "$PACKAGE/$ACTIVITY" || fail "adb shell am start failed"

# R133: a fixed sleep is a guess, not a positive signal. A cold start on a
# freshly-wiped emulator was measured at 14.3s here (dexopt + ART bytecode
# verification) - a fixed 3s sleep captured a blank canvas with nothing
# rendered yet, found by actually looking at the PNG (R176/R177), not
# assumed. This polls logcat for the framework's own "Displayed" line
# instead, which fires the moment the activity is actually on screen.
echo "waiting for '$PACKAGE' to report Displayed..."
DISPLAY_TIMEOUT_SECONDS=60
waited=0
while true; do
  if "$ADB_BIN" logcat -d | grep -q "Displayed $PACKAGE/"; then
    echo "Displayed after ${waited}s"
    break
  fi
  if [ "$waited" -ge "$DISPLAY_TIMEOUT_SECONDS" ]; then
    fail "activity did not report Displayed within ${DISPLAY_TIMEOUT_SECONDS}s"
  fi
  sleep 2
  waited=$((waited + 2))
done

"$SCRIPT_DIR/screenshot.sh" "$OUTPUT_PATH"
echo "WALKTHROUGH PNG: $OUTPUT_PATH"
