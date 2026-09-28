package ch.monreleve.app.data.sync

import ch.monreleve.app.calc.repoRoot
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * AN5 increment 3. The batch and note limits are the SERVER'S named constants, derived
 * from web/lib/entries/schema.ts, never guessed (R0.2) and never transcribed (R181). A
 * change on the server - the batch limit widening, the note cap moving - goes red here
 * rather than silently letting the client build a batch the server will 413/400.
 */
class BatchLimitParityTest {
    private val schemaSource: String by lazy {
        val file = File(repoRoot(), "web/lib/entries/schema.ts")
        check(file.exists()) { "the server's entry schema was not found at ${file.absolutePath}" }
        file.readText()
    }

    private fun serverConstant(name: String): Int {
        val match =
            Regex("""const\s+$name\s*=\s*(\d+)""").find(schemaSource)
                ?: error("constant `$name` not found in web/lib/entries/schema.ts")
        return match.groupValues[1].toInt()
    }

    @Test
    fun theBatchLimitMatchesTheServer() {
        assertEquals(serverConstant("MAX_BATCH_ITEMS"), MAX_BATCH_ITEMS)
    }

    @Test
    fun theNoteCapMatchesTheServer() {
        assertEquals(serverConstant("MAX_NOTE_LENGTH"), MAX_NOTE_LENGTH)
    }
}
