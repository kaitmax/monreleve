package ch.monreleve.app

import androidx.compose.runtime.saveable.Saver

// IOS-MOVE-GRAPH (R1310). THE SHELL'S DESTINATION LOGIC, ONE HOME FOR EVERY PLATFORM. Destination was declared in
// MainActivity.kt and the four functions below were ShellState.kt's, with the comments above each, moved here as they
// were. ShellState.kt keeps the Android half - the rememberSaveable seams and the controllers' construction through
// MainGraph - under its own name. This file is named after its one class (detekt's and ktlint's file-name rules), and
// could not have been ShellState.kt: MovedTwinsFenceTest refuses a moved FILE name in :app. Every declaration here
// lost `internal` and nothing else: :shared declares no friend path to :app, so an internal declaration would be
// invisible to MainActivity, ShellState and ForcedSignOutTest (IOS-MOVE-SEAM's precedent). The test names in the
// comments below were SessionReconciledTest, which R1311 transcribed to kotlin.test and moved to commonTest, same
// package, as SessionReconciledPinTest.

/** Where the shell is: signing in, resolving a fresh sign-in against GET /me, onboarding, or the main shell. */
enum class Destination { SIGN_IN, RESOLVING, ONBOARDING, MAIN }

// AN-STATE (R310): a destination restored across a rebuild, reconciled against the current session. A saved
// MAIN restored after a sign-out-while-backgrounded (or an expiry) would land an unsigned shell, so when the
// recomputed `start` says SIGN_IN (no session) that wins. A restored in-flight RESOLVING is re-decided. A
// saved ONBOARDING/MAIN is honoured while signed in - so a rotation mid-onboarding stays on onboarding rather
// than re-running the RESOLVING network round-trip. Pure, so SessionReconciledPinTest covers it on the JVM and the iOS
// simulator.
fun sessionReconciled(
    saved: Destination,
    start: Destination,
): Destination = if (start == Destination.SIGN_IN || saved == Destination.RESOLVING) start else saved

// AN-FORCED-SIGNOUT (R521). THE DESTINATION'S SAVER RECONCILES AS IT RESTORES. sessionReconciled ran only in a
// LaunchedEffect - AFTER the first frame had composed the restored destination. A MAIN restored with no session then
// built the shell's controllers for one frame, and ParametresController requires settings (checkNotNull): R521 clears
// them on a sign-out nobody asked for, so a session the worker ended in the background, then a process death, would
// restore MAIN onto no settings and crash before the reconcile ran. Reconciled here, the first frame is already right.
fun destinationSaver(start: Destination): Saver<Destination, Destination> =
    Saver(save = { it }, restore = { sessionReconciled(saved = it, start = start) })

// The destination decided once at launch, from two facts - is there a session, and is this device onboarded. Moved
// out of MainActivity.onCreate unchanged (AN-FORCED-SIGNOUT, R521) so a JVM test can ask it: PARK-T2's link half was a
// sign-in by link on a phone whose settings had survived a forced sign-out, which this sent straight to MAIN on them.
fun startDestination(
    signedIn: Boolean,
    onboarded: Boolean,
): Destination =
    when {
        !signedIn -> Destination.SIGN_IN
        onboarded -> Destination.MAIN
        // R297: signed in but no local settings - a fresh account, or a re-sign-in after a sign-out cleared them.
        // Consult the server (GET /api/v1/me) before onboarding, so settings the server holds are restored rather
        // than re-asked.
        else -> Destination.RESOLVING
    }

// AN-FORCED-SIGNOUT (R520). WHERE THE PERSON GOES WHEN THE SERVER ENDS THE SESSION WHILE THE APP IS OPEN: to sign-in,
// from any screen - the shell, onboarding, RESOLVING - never left on a signed-in screen whose only way out was the
// voluntary sign-out that wipes the days this keeps (PARK-T1). `start` above decides it at launch; this decides it on
// the process's session-end signal, which arrives while the app is already open. Still signed in by the time the
// signal is read (a new sign-in saved its pair first) leaves the person where they are. Pure, so
// SessionReconciledPinTest covers it on the JVM and the iOS simulator.
fun destinationAfterSessionEnd(
    current: Destination,
    signedIn: Boolean,
): Destination = if (signedIn) current else Destination.SIGN_IN
