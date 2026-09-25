#!/usr/bin/env bash
# android/scripts/emulator.sh - the headless-emulator half of AN1's instrument
# (relay/AN1.txt increment 4, AC2). There is no page to curl for a Compose
# screen; this is the substitute the whole AN-series depends on.
#
# ORPHAN DISCIPLINE (R98/R105/R179): asserts no stale emulator/adb-server
# state before starting, and `stop` kills the WHOLE process tree it spawned,
# by command-line match against this AVD - not a bare `kill $pid`. On
# Windows, `emulator.exe` spawns a child qemu-system process; the launcher
# PID alone is not the tree, and killing only it would leave the real
# emulation process running as a fifth concurrency-class orphan (found live,
# not planted: this harness's own long-running-command kill left exactly
# that orphan on this script's first real run, and the command-line sweep
# below is what found and closed it - see REPORT-AN1.txt).
#
# launch/wait-boot ARE SPLIT, not one `start` (found necessary, not assumed):
# this environment kills long-running foreground commands, including a
# blocking boot-wait. The spawned emulator survives that kill; `launch`
# returns in under a second so it is never the thing killed, and `wait-boot`
# only polls state, so re-invoking it after a kill is safe and idempotent.
#
# PLAY-STORE AVD NOTE (found on this AVD, Pixel_10 = google_apis_playstore):
# a Play-Store-enabled system image is a production-signed ("user") build,
# which requires ADB key authorization via an on-screen dialog - impossible
# headless. A device's FIRST-EVER boot auto-trusts the host's existing
# ~/.android/adbkey without that dialog (nothing to protect yet), so `launch`
# passes -wipe-data to force a fresh first boot every time. This is the
# tradeoff that makes a Play-Store image usable headless at all; it costs
# the AVD's persisted state each run, which is fine for a placeholder screen
# with nothing to persist.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="$(grep '^sdk.dir=' "$ANDROID_DIR/local.properties" | cut -d= -f2-)"
AVD_NAME="Pixel_10"
PID_FILE="$ANDROID_DIR/.emulator.pid"
LOG_FILE="$ANDROID_DIR/.emulator.log"
BOOT_TIMEOUT_SECONDS=180

EMULATOR_BIN="$SDK_DIR/emulator/emulator.exe"
ADB_BIN="$SDK_DIR/platform-tools/adb.exe"

fail() {
  echo "EMULATOR SCRIPT FAILED: $1" >&2
  exit 1
}

# Windows-native sweep: every process (emulator.exe OR qemu-system*) whose
# command line names this AVD. Returns one "PID<TAB>Name" pair per line.
find_avd_processes() {
  powershell.exe -NoProfile -Command \
    "Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -like '*${AVD_NAME}*' -and (\$_.Name -like 'emulator*' -or \$_.Name -like 'qemu*') } | ForEach-Object { \"\$(\$_.ProcessId)\`t\$(\$_.Name)\" }" \
    2>/dev/null | tr -d '\r'
}

kill_avd_processes() {
  local found
  found="$(find_avd_processes)"
  if [ -z "$found" ]; then
    echo "no $AVD_NAME process found"
    return 0
  fi
  echo "found and killing:"
  echo "$found" | while IFS=$'\t' read -r pid name; do
    [ -n "$pid" ] || continue
    echo "  PID $pid ($name)"
    taskkill //PID "$pid" //T //F >/dev/null 2>&1 || true
  done
}

cmd_launch() {
  [ -f "$EMULATOR_BIN" ] || fail "emulator binary not found at $EMULATOR_BIN"
  [ -f "$ADB_BIN" ] || fail "adb binary not found at $ADB_BIN"

  # Orphan discipline: name what is found before starting anything.
  local existing
  existing="$(find_avd_processes)"
  if [ -n "$existing" ]; then
    fail "a $AVD_NAME process is already running (this script did not start it this session):
$existing
Run '$0 stop' first, or investigate before continuing."
  fi
  local visible_devices
  visible_devices="$("$ADB_BIN" devices | grep -c '^emulator-' || true)"
  if [ "$visible_devices" -gt 0 ]; then
    fail "$visible_devices emulator device(s) already visible to adb - refusing to start a second one"
  fi
  if [ -f "$PID_FILE" ]; then
    echo "removing stale PID file $PID_FILE (no matching process found above)"
    rm -f "$PID_FILE"
  fi

  echo "launching AVD $AVD_NAME headless (-no-window -no-audio -no-boot-anim -wipe-data)..."
  "$EMULATOR_BIN" -avd "$AVD_NAME" -no-window -no-audio -no-boot-anim -wipe-data \
    > "$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  echo "spawned launcher PID $pid (log: $LOG_FILE). This command returns immediately -" \
    "run '$0 wait-boot' to block until boot completes."
}

# Split from launch (found necessary, not assumed in advance): this
# environment kills long-running foreground commands, but the emulator
# process it spawns survives that kill (verified empirically - the launcher
# PID recorded at launch time is not even necessarily the surviving PID,
# since emulator.exe spawns a qemu-system child; see find_avd_processes).
# wait-boot is therefore idempotent and safe to re-invoke after a kill: it
# only polls state, it starts nothing.
cmd_wait_boot() {
  [ -f "$ADB_BIN" ] || fail "adb binary not found at $ADB_BIN"

  echo "adb wait-for-device..."
  if ! "$ADB_BIN" wait-for-device; then
    fail "adb wait-for-device did not return - see $LOG_FILE"
  fi

  echo "polling sys.boot_completed (timeout ${BOOT_TIMEOUT_SECONDS}s)..."
  local waited=0
  while true; do
    local booted
    booted="$("$ADB_BIN" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n')"
    if [ "$booted" = "1" ]; then
      break
    fi
    if [ "$waited" -ge "$BOOT_TIMEOUT_SECONDS" ]; then
      fail "boot did not complete within ${BOOT_TIMEOUT_SECONDS}s (sys.boot_completed never reported 1) - see $LOG_FILE"
    fi
    sleep 3
    waited=$((waited + 3))
  done

  local serial
  serial="$("$ADB_BIN" devices | grep '^emulator-' | head -1 | cut -f1)"
  [ -n "$serial" ] || fail "boot_completed=1 but no emulator-* serial is visible to adb"

  echo "BOOTED: $serial"
}

cmd_stop() {
  kill_avd_processes
  rm -f "$PID_FILE"
  sleep 1
  local remaining
  remaining="$(find_avd_processes)"
  if [ -n "$remaining" ]; then
    fail "process(es) survived the kill attempt:
$remaining"
  fi
  echo "confirmed: no $AVD_NAME process remains"
}

cmd_status() {
  local found
  found="$(find_avd_processes)"
  if [ -n "$found" ]; then
    echo "running:"
    echo "$found"
    exit 0
  fi
  echo "no tracked emulator running"
  exit 1
}

case "${1:-}" in
  launch) cmd_launch ;;
  wait-boot) cmd_wait_boot ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  *) fail "usage: $0 {launch|wait-boot|stop|status}" ;;
esac
