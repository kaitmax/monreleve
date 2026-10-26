package ch.monreleve.app.shared

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-1a R567. The identity hashes the iOS database test asserts (commonTest SchemaIdentityHashes) are the ones
// Room wrote into schemas/<n>.json. Read from the files here, on the JVM, where files are reachable; the
// simulator test cannot read them, so it holds constants and THIS test holds the constants to the files.
class IdentityHashConstantTest {
    private fun hashOf(version: Int): String {
        val file = File("schemas/ch.monreleve.app.data.local.MonReleveDatabase/$version.json")
        assertTrue(file.isFile, "no such schema file: ${file.absolutePath}")
        return Regex("\"identityHash\"\\s*:\\s*\"([0-9a-f]+)\"").find(file.readText())!!.groupValues[1]
    }

    @Test
    fun theConstantsAreTheHashesInTheExportedSchemas() {
        assertEquals(SchemaIdentityHashes.V1, hashOf(1))
        assertEquals(SchemaIdentityHashes.V5, hashOf(5))
        assertEquals(SchemaIdentityHashes.V6, hashOf(6))
    }
}
