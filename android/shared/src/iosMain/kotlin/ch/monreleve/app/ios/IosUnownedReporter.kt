package ch.monreleve.app.ios

import kotlin.experimental.ExperimentalNativeApi
import kotlin.native.Platform

// IOS-1a R568. R425's canary, iOS's way, the SAME way as Android's AndroidRecordSeams.reportUnownedWhileSignedIn:
// DEBUG CRASHES, RELEASE LOGS. A reader's day is not worth losing to keep an app alive, but neither is crashing
// somebody mid-record in the field over a condition they cannot act on; the log names the condition so it is
// findable either way. Android catches the debug crash BY TYPE (IllegalStateException), so this throws exactly
// that, through the same `check`. It is the `reportUnownedWhileSignedIn` seam of LocalEntryRepository.
//
// "Debug" is the Kotlin/Native binary's own flag (Platform.isDebugBinary), which the iOS app target can override
// by passing [isDebug] from its build configuration in iOS-1c; the default is the binary's own answer.

private const val TAG = "EntryRepository"

@OptIn(ExperimentalNativeApi::class)
class IosUnownedReporter(
    private val logger: IosLogger = IosLogger(),
    private val isDebug: Boolean = Platform.isDebugBinary,
) {
    fun report(complaint: String) {
        check(!isDebug) { complaint }
        logger.error(TAG, complaint)
    }
}
