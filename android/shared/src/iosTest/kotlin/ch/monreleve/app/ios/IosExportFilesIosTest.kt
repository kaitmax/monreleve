package ch.monreleve.app.ios

import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.contracts.MemoryTokenStore
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.remote.ExportBytes
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.releve.ExportKind
import ch.monreleve.app.releve.ReleveController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import platform.Foundation.NSFileManager
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

// IOS-2f R891. THE FILE THE SHARE SHEET WOULD HAND OVER, produced by the SHARED export path and written by iOS:
//   1. the Android path's own fixture - ReleveControllerTest's "%PDF" bytes and "releve-2026-camille-rey.pdf" - through
//      the shared ReleveController to ExportEvent.Ready, and IosExportFiles writes exactly those bytes under exactly
//      that name in <temporary directory>/exports;
//   2. END TO END over the REAL iOS transport: the process's SessionManager over AuthApi over NsUrlSessionTransport
//      fetches the wire server's binary route (256 bytes, every value 0..255, Content-Disposition
//      filename="releve-2026.pdf") as iOS's exportBytes, the shared controller turns it into the event, and the file
//      on disk is those 256 bytes - none re-encoded, none dropped;
//   3. the clear is the one directory, so a written export is gone after it (the LocalStore's clearExports, R889).
// The share sheet itself (UIActivityViewController) is PARKED to IOS-1b-B; this is the file it will be handed.

/** The repository the Releve reads: no rows (the export does not read them). */
private class R891NoRows : EntryRepository {
    override suspend fun record(command: RecordCommand): RecordResult = error("the export never records")

    override fun observePending(): Flow<List<EntryEntity>> = flowOf(emptyList())

    override fun observeAll(): Flow<List<EntryEntity>> = flowOf(emptyList())
}

class IosExportFilesIosTest {
    private suspend fun readyFrom(exportBytes: suspend (String) -> BytesOutcome): ExportEvent.Ready {
        val scope = CoroutineScope(Job())
        try {
            val controller =
                ReleveController(
                    fetch = { DossierResult.Unreadable },
                    exportBytes = exportBytes,
                    repository = R891NoRows(),
                    taxYear = 2026,
                    scope = scope,
                )
            controller.export(ExportKind.PDF)
            val event = ios2fBounded("the shared export's event") { controller.exportEvents.first() }
            return assertIs<ExportEvent.Ready>(event)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun theAndroidPathsFixtureBecomesTheFileUnderItsServerName() =
        runBlocking {
            val directory = freshTempDirectory()
            val bytes = byteArrayOf(0x25, 0x50, 0x44, 0x46) // %PDF - ReleveControllerTest's fixture
            val requested = mutableListOf<String>()
            val event =
                readyFrom { path ->
                    requested += path
                    BytesOutcome.Ok(200, ExportBytes(bytes, "releve-2026-camille-rey.pdf"))
                }
            assertEquals(listOf("/api/v1/export/pdf?year=2026"), requested, "the shared controller asked its own path")

            val files = IosExportFiles("$directory/exports")
            val path = files.write(event)

            assertEquals("$directory/exports/releve-2026-camille-rey.pdf", path, "Android's shape: exports/<filename>")
            assertContentEquals(bytes, readFileBytes(path), "the file is the shared export's bytes, verbatim")
            assertEquals("application/pdf", event.mimeType, "the type the share sheet will be told")
            removeDirectory(directory)
        }

    @Test
    fun theRealTransportsBytesReachTheFileUnaltered() =
        runBlocking {
            val directory = freshTempDirectory()
            val pair = TokenPair("r891-access", "r891-refresh", "2027-01-01T00:00:00.000Z", "2027-03-01T00:00:00.000Z")
            val tokens = MemoryTokenStore(arrayOf<TokenPair?>(pair))
            val session = SessionManager(AuthApi(NsUrlSessionTransport(), WIRE_BASE), tokens)
            val requested = mutableListOf<String>()
            // iOS's exportBytes is session::authenticatedGetBytes, as Android's is; the wire server has ONE binary
            // route, so the controller's path is recorded and the session fetches that route in its place.
            val event =
                readyFrom { path ->
                    requested += path
                    session.authenticatedGetBytes("/__bytes")
                }
            assertEquals(listOf("/api/v1/export/pdf?year=2026"), requested)
            assertEquals("releve-2026.pdf", event.filename, "the server's Content-Disposition name (R237)")

            val path = IosExportFiles("$directory/exports").write(event)

            assertEquals("$directory/exports/releve-2026.pdf", path)
            assertContentEquals(ByteArray(256) { it.toByte() }, readFileBytes(path), "every byte value, 0..255, intact")
            removeDirectory(directory)
        }

    @Test
    fun theClearDeletesTheOneDirectoryAndIsANoOpWhenThereIsNone() {
        val directory = freshTempDirectory()
        val files = IosExportFiles("$directory/exports")
        files.clear() // nothing written yet: a no-op, never a failure
        val first = files.write(ExportEvent.Ready(byteArrayOf(7), "mon-releve.json", "application/json"))
        val second = files.write(ExportEvent.Ready(byteArrayOf(8, 9), "mon-releve.csv", "text/csv"))
        assertTrue(NSFileManager.defaultManager.fileExistsAtPath(first), "control: the JSON export is on disk")
        assertTrue(NSFileManager.defaultManager.fileExistsAtPath(second), "control: the CSV export is on disk")

        files.clear()

        assertFalse(NSFileManager.defaultManager.fileExistsAtPath(first), "the JSON export is gone")
        assertFalse(NSFileManager.defaultManager.fileExistsAtPath(second), "the CSV export is gone")
        assertFalse(NSFileManager.defaultManager.fileExistsAtPath(files.directoryPath), "the directory is gone")
        val again = files.write(ExportEvent.Ready(byteArrayOf(1), "mon-releve.json", "application/json"))
        assertContentEquals(byteArrayOf(1), readFileBytes(again), "the next export recreates the directory")
        removeDirectory(directory)
    }

    @Test
    fun theDefaultDirectoryIsTheAppsTemporaryDirectorysExports() {
        assertTrue(IosExportFiles().directoryPath.endsWith("/exports"), "Android's EXPORTS_DIR name")
        assertEquals(iosExportsDirectory(), IosExportFiles().directoryPath)
    }
}
