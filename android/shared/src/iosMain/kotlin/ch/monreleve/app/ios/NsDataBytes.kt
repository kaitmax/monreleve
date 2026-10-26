package ch.monreleve.app.ios

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.convert
import kotlinx.cinterop.usePinned
import platform.Foundation.NSData
import platform.Foundation.NSMutableData
import platform.Foundation.appendBytes
import platform.Foundation.dataWithContentsOfFile
import platform.Foundation.writeToFile
import platform.posix.memcpy

// IOS-1a. The two byte conversions every iOS implementation shares, in the form ktor's Darwin engine uses
// (read from its DarwinUtils.kt, 2026-10-26). A body is always bytes, never an NSString round trip: the
// server's bytes and our UTF-8 are the contract, and an encoding conversion in the middle is where they drift.

@OptIn(ExperimentalForeignApi::class)
internal fun ByteArray.toNSData(): NSData =
    NSMutableData().apply {
        if (isEmpty()) return@apply
        this@toNSData.usePinned { appendBytes(it.addressOf(0), size.convert()) }
    }

@OptIn(ExperimentalForeignApi::class)
internal fun NSData.toByteArray(): ByteArray {
    val result = ByteArray(length.toInt())
    if (result.isEmpty()) return result
    result.usePinned { memcpy(it.addressOf(0), bytes, length) }
    return result
}

/** The file's bytes, or null when there is no such file. */
internal fun readFileBytes(path: String): ByteArray? = NSData.dataWithContentsOfFile(path)?.toByteArray()

/** Writes [bytes] to [path] atomically (temp file, then rename): a reader sees the old file or the new. */
internal fun writeFileBytesAtomically(
    path: String,
    bytes: ByteArray,
): Boolean = bytes.toNSData().writeToFile(path, atomically = true)
