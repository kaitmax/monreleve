package ch.monreleve.app.ios

import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.delay
import platform.Foundation.NSFileManager
import platform.Foundation.NSTemporaryDirectory
import platform.Foundation.NSUUID

// IOS-1a. Small helpers the simulator tests share. Nothing here is product code.

/** A fresh empty directory under the simulator's temporary directory; returns its path. */
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
internal fun freshTempDirectory(): String {
    val path = NSTemporaryDirectory().trimEnd('/') + "/ios1a-" + NSUUID().UUIDString()
    NSFileManager.defaultManager.createDirectoryAtPath(
        path,
        withIntermediateDirectories = true,
        attributes = null,
        error = null,
    )
    return path
}

@OptIn(ExperimentalForeignApi::class)
internal fun removeDirectory(path: String) {
    NSFileManager.defaultManager.removeItemAtPath(path, null)
}

internal fun uniqueName(prefix: String): String = prefix + "." + NSUUID().UUIDString().lowercase()

/** Polls [condition] every 100 ms for up to [timeoutMillis]; true as soon as it holds, false if it never did. */
internal suspend fun eventually(
    timeoutMillis: Long = 8_000,
    condition: suspend () -> Boolean,
): Boolean {
    var waited = 0L
    while (waited <= timeoutMillis) {
        if (condition()) return true
        delay(100)
        waited += 100
    }
    return false
}
