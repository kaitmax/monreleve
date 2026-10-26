package ch.monreleve.app.ios

import ch.monreleve.app.data.local.DossierCache
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import platform.Foundation.NSApplicationSupportDirectory
import platform.Foundation.NSFileManager
import platform.Foundation.NSLock
import platform.Foundation.NSURL
import platform.Foundation.NSURLIsExcludedFromBackupKey
import platform.Foundation.NSUserDomainMask

// IOS-1a R566. THE iOS DossierCache: one small file per year under Application Support, EXCLUDED FROM BACKUP.
//
// ONE FILE PER YEAR HOLDING THE BODY AND ITS STALE FLAG TOGETHER. The contract (AN-RELEVE-FRESH R559) says save
// clears the flag "in the same write as the body" so a reader never sees the new body still flagged nor the old
// body unflagged. Two files (a body and a marker) cannot be written together; one file replaced atomically can.
// The file is a JSON envelope {"body": <the server's bytes as a string>, "stale": <bool>}. The body is stored
// VERBATIM - JSON string escaping round-trips every byte - so the generatedAt inside it is still the server's.
//
// markStale rewrites the envelope with the body untouched; a year with no copy gets an envelope with a null body,
// which load reports as null (no body is created) and isStale reports as true. The state lives on disk and every
// call reads it afresh, so a flag set through one instance is visible to any other at once, as the worker and the
// screen need. A process-wide lock serialises the read-modify-write cycles of markStale and save.
//
// EXCLUDED FROM BACKUP: NSURLIsExcludedFromBackupKey on the directory. A cached releve carries the titulaire's
// name; it is re-fetchable and must not ride an iCloud backup onto another device. It is never logged.

private const val DIRECTORY_NAME = "monreleve-dossier"

@Serializable
private class Envelope(
    val body: String? = null,
    val stale: Boolean = false,
)

private val cacheLock = NSLock()

private fun <T> locked(block: () -> T): T {
    cacheLock.lock()
    try {
        return block()
    } finally {
        cacheLock.unlock()
    }
}

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class FileDossierCache(
    private val directoryPath: String = applicationSupportPath() + "/" + DIRECTORY_NAME,
) : DossierCache {
    override fun load(year: Int): String? = locked { readEnvelope(year)?.body }

    override fun save(
        year: Int,
        body: String,
    ) = locked { writeEnvelope(year, Envelope(body = body, stale = false)) }

    override fun clear() =
        locked {
            val manager = NSFileManager.defaultManager
            if (manager.fileExistsAtPath(directoryPath)) manager.removeItemAtPath(directoryPath, null)
            Unit
        }

    override fun markStale(year: Int) =
        locked {
            val current = readEnvelope(year)
            if (current?.stale != true) writeEnvelope(year, Envelope(body = current?.body, stale = true))
        }

    override fun isStale(year: Int): Boolean = locked { readEnvelope(year)?.stale == true }

    private fun fileFor(year: Int): String = "$directoryPath/dossier.$year.json"

    private fun readEnvelope(year: Int): Envelope? {
        val bytes = readFileBytes(fileFor(year)) ?: return null
        return runCatching { Json.decodeFromString(Envelope.serializer(), bytes.decodeToString()) }.getOrNull()
    }

    private fun writeEnvelope(
        year: Int,
        envelope: Envelope,
    ) {
        ensureDirectory()
        val encoded = Json.encodeToString(Envelope.serializer(), envelope).encodeToByteArray()
        check(writeFileBytesAtomically(fileFor(year), encoded)) { "the cached releve for $year could not be written" }
    }

    private fun ensureDirectory() {
        val manager = NSFileManager.defaultManager
        if (!manager.fileExistsAtPath(directoryPath)) {
            manager.createDirectoryAtPath(
                directoryPath,
                withIntermediateDirectories = true,
                attributes = null,
                error = null,
            )
        }
        NSURL.fileURLWithPath(directoryPath).setResourceValue(true, forKey = NSURLIsExcludedFromBackupKey, error = null)
    }
}

/** The app's Application Support directory (created if need be). */
@OptIn(ExperimentalForeignApi::class)
internal fun applicationSupportPath(): String {
    val url =
        NSFileManager.defaultManager.URLForDirectory(
            NSApplicationSupportDirectory,
            inDomain = NSUserDomainMask,
            appropriateForURL = null,
            create = true,
            error = null,
        )
    return checkNotNull(url?.path) { "Application Support is unavailable" }
}
