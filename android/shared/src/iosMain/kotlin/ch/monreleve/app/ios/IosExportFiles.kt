package ch.monreleve.app.ios

import ch.monreleve.app.releve.ExportEvent
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSFileManager
import platform.Foundation.NSTemporaryDirectory

// IOS-2f R891. THE FILE THE SHARE SHEET WOULD HAND OVER - Android's MainActivity.shareFile, minus the share.
//
// Android writes a Ready export's bytes to cacheDir/exports/<the event's filename> and hands that file to the chooser;
// the device erasure deletes the same directory (DeviceLocalStores.kt: EXPORTS_DIR = "exports", "ONE home: shareFile
// writes here and the device erasure deletes here"). iOS does the same in the app's TEMPORARY directory
// (NSTemporaryDirectory, which no backup carries): write() puts the bytes there VERBATIM under the filename the shared
// controller chose (the server's Content-Disposition name, or the controller's fallback, R237) and returns the path the
// share sheet will be given; clear() deletes the one directory, and is the LocalStore's clearExports (R889) - so the
// writer and the erasure share one path by construction, as Android's do. A rendered export is the record in another
// form (the account JSON is the whole record), which is why sign-out and deletion delete it (R289).
//
// The bytes are the server's render; nothing here reads, parses or re-encodes them. The SHARE ITSELF
// (UIActivityViewController, presented from the app's window) needs the app host and is PARKED to IOS-1b-B (R893).

/** The exports subdirectory's name - Android's EXPORTS_DIR value, so both platforms name the same thing. */
internal const val EXPORTS_DIRECTORY_NAME = "exports"

/** <the app's temporary directory>/exports. */
fun iosExportsDirectory(): String = NSTemporaryDirectory().trimEnd('/') + "/" + EXPORTS_DIRECTORY_NAME

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class IosExportFiles(
    val directoryPath: String = iosExportsDirectory(),
) {
    /** Writes [event]'s bytes to <directory>/<event.filename> and returns that path (Android's shareFile's file). */
    fun write(event: ExportEvent.Ready): String {
        val manager = NSFileManager.defaultManager
        if (!manager.fileExistsAtPath(directoryPath)) {
            manager.createDirectoryAtPath(
                directoryPath,
                withIntermediateDirectories = true,
                attributes = null,
                error = null,
            )
        }
        val path = "$directoryPath/${event.filename}"
        // Android's File.writeBytes throws when the file cannot be written; so does this - never an empty share.
        check(writeFileBytesAtomically(path, event.bytes)) { "the export could not be written" }
        return path
    }

    /** Deletes the exports directory and everything in it (Android's clearExports); a no-op when there is none. */
    fun clear() {
        val manager = NSFileManager.defaultManager
        // Android's deleteRecursively() result is ignored there; a removal that fails is ignored here the same way.
        if (manager.fileExistsAtPath(directoryPath)) manager.removeItemAtPath(directoryPath, null)
    }
}
