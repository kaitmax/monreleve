package ch.monreleve.app.data.remote

import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

// AN-SHARED-FIXES (R1092). THE SERVER'S FILENAME IS JOINED TO A DIRECTORY ON BOTH PLATFORMS - Android's
// File(cacheDir/exports, name) (MainActivity.shareFile) and iOS's "<tmp>/exports/<name>" (IosExportFiles.write) - so
// a name that is not a plain file name would write outside exports/ and escape the sign-out's export clear (C8's N1,
// Queue Ruling 11). The orchestrator's decision: a name holding "/", "\", a NUL or other control character, equal
// to ".." (the one way ".." is a path segment once both separators are refused), or empty after trimming, is treated
// EXACTLY as an absent name - null - so each caller's existing no-name path applies (the controllers' year-named
// fallback, R237) and nothing new is invented.
//
// commonTest, so the same refusals run on the JVM (:shared's testDebugUnitTest) and on the iOS simulator (the R573
// run). The legitimate names are the SERVER'S, derived from web/'s export routes in FilenameOfServerNamesTest
// (androidUnitTest: deriving them needs file access, which commonTest has not got on iOS).

private fun disposition(name: String): Map<String, String> =
    mapOf("Content-Disposition" to "attachment; filename=\"$name\"")

private const val BASE = "http://10.0.2.2:3000"

private class BytesTransport(
    private val headers: Map<String, String>,
) : HttpTransport {
    override suspend fun execute(request: HttpRequest): HttpResponse = error("not used")

    override suspend fun executeForBytes(request: HttpRequest): HttpBytesResponse =
        HttpBytesResponse(200, byteArrayOf(1, 2, 3), headers)
}

class FilenameOfTest {
    @Test
    fun aNameWithASlashIsAbsent() {
        assertNull(filenameOf(disposition("../../files/evil.pdf")))
        assertNull(filenameOf(disposition("exports/releve-2026.pdf")))
        assertNull(filenameOf(disposition("/data/data/ch.monreleve.app/files/x.pdf")))
    }

    @Test
    fun aNameWithABackslashIsAbsent() {
        assertNull(filenameOf(disposition("..\\..\\evil.pdf")))
        assertNull(filenameOf(disposition("dir\\releve-2026.pdf")))
    }

    @Test
    fun aNameWithANulOrOtherControlCharacterIsAbsent() {
        assertNull(filenameOf(disposition("releve-2026.pdf\u0000.exe")))
        assertNull(filenameOf(disposition("releve\u00012026.pdf")))
        assertNull(filenameOf(disposition("releve-2026\n.pdf")))
        assertNull(filenameOf(disposition("releve\u007F2026.pdf")))
        assertNull(filenameOf(disposition("releve\u00852026.pdf")))
    }

    @Test
    fun dotDotAsTheWholeNameIsAbsent() {
        assertNull(filenameOf(disposition("..")))
        assertNull(filenameOf(disposition("  ..  ")))
    }

    @Test
    fun aNameEmptyAfterTrimmingIsAbsent() {
        assertNull(filenameOf(disposition("   ")))
        assertNull(filenameOf(mapOf("Content-Disposition" to "attachment; filename=\"\"")))
    }

    @Test
    fun noDispositionAndNoFilenameStayAbsent() {
        assertNull(filenameOf(emptyMap()))
        assertNull(filenameOf(mapOf("Content-Disposition" to "attachment")))
    }

    // The refusal is SEGMENT-wise, not a substring search: ".." inside a plain name is not a path segment.
    @Test
    fun dotsInsideAPlainNamePassThroughUnchanged() {
        assertEquals("releve..2026.pdf", filenameOf(disposition("releve..2026.pdf")))
        assertEquals("releve-2026...pdf", filenameOf(disposition("releve-2026...pdf")))
    }

    // The header name is matched case-insensitively and the surrounding blanks trimmed, as before.
    @Test
    fun aPlainNamePassesThroughUnchanged() {
        assertEquals(
            "releve-2026.pdf",
            filenameOf(mapOf("content-disposition" to "attachment; filename=\" releve-2026.pdf \"")),
        )
    }

    // R204: through the real export entry (AuthApi.authenticatedGetBytes), a hostile name reaches the caller as NO
    // name - the shape the controllers already answer with their year-named fallback (ReleveControllerTest's
    // "falls back to a year-named file", ParametresController's same `?: fallbackFilename(kind)`).
    @Test
    fun theExportEntryHandsAHostileNameOnAsNoName() =
        runTest {
            val api = AuthApi(BytesTransport(disposition("../../shared_prefs/evil.xml")), BASE)
            val result = api.authenticatedGetBytes("/api/v1/dossier/2026/pdf", "token")
            assertIs<AuthedResult.Ok<ExportBytes>>(result)
            assertNull(result.value.filename)
        }

    @Test
    fun theExportEntryHandsAPlainNameOnUnchanged() =
        runTest {
            val api = AuthApi(BytesTransport(disposition("releve-2026.pdf")), BASE)
            val result = api.authenticatedGetBytes("/api/v1/dossier/2026/pdf", "token")
            assertIs<AuthedResult.Ok<ExportBytes>>(result)
            assertEquals("releve-2026.pdf", result.value.filename)
        }
}
