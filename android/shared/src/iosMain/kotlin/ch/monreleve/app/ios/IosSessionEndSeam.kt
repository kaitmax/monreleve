package ch.monreleve.app.ios

import ch.monreleve.app.auth.SessionEndSeam
import platform.UserNotifications.UNUserNotificationCenter

// IOS-MOVE-SEAM (R1281). WHAT AN iOS DEVICE STOPS WHEN A SESSION ENDS - the iOS body of the "session ended" seam
// (auth/SessionEndSeam.kt, commonMain), the counterpart of Android's deviceSessionEndSeam (:app
// auth/DeviceSessionEndSeam.kt). I0's FINDING 2: iosDeviceLocalStore had no seam, so nothing on iOS would cancel a
// reminder already scheduled ahead at a sign-out, a deletion or a server-ended session.
//
// iOS v1 is manual-only (iOS Ruling 2): no sampler, no push. What runs on the person's behalf while the app is not
// running is a LOCAL notification request - the evening reminder move 4 schedules up to 7 working days ahead (iOS
// Ruling 2, C8 Q1). So the one stop is: this app's PENDING requests removed, on every path (the same for each, as
// Android's body is). DELIVERED notifications are left to the person - they are already on the screen, and nothing
// fires from them.
//
// THE CENTRE IS RESOLVED INSIDE THE ACTION, never when the seam is built: UNUserNotificationCenter raises an
// Objective-C exception in a process with no app bundle (the simulator test binary - AppHostProbeIosTest's header), so
// building the device's store must not touch it, and the tests pass their own action. That the real call removes the
// requests is proven on the simulator by I2's walkthrough (a pending request before sign-out, none after).
//
// IDEMPOTENT, as every attachment must be: removing from an empty list is nothing. The call returns at once and the
// removal completes asynchronously; the wrapper (SessionEndingStore) runs this first and the clear in a finally.
//
// IOS-SHELL-3 R1371: THE YEAR DOWNLOADS STOP HERE TOO. A year still arriving when a session ends must not land in the
// store the ending empties, nor under the next account to sign in (one account's entries never reach another's
// database). Android stops them in its clearRecord (account/DeviceLocalStores.kt) before the record is cleared; iOS
// stops them through this seam, which the wrapper runs BEFORE the clear, on every ending path - the voluntary sign-out,
// the deletion and a session the server ended. Stopping is a cancel (YearDownloads.stop), so it holds no ending up.

/**
 * The iOS seam: [stopYearDownloads], then [removePendingRequests], on every ending path. The removal's default is the
 * production call; a test passes its own, because the real one cannot run in the bundle-less test process. The
 * downloads' default stops nothing: startIosShell - the one production caller - passes its coordinator's stop.
 */
fun iosSessionEndSeam(
    removePendingRequests: () -> Unit = {
        UNUserNotificationCenter.currentNotificationCenter().removeAllPendingNotificationRequests()
    },
    stopYearDownloads: () -> Unit = {},
): SessionEndSeam =
    SessionEndSeam {
        stopYearDownloads()
        removePendingRequests()
    }
