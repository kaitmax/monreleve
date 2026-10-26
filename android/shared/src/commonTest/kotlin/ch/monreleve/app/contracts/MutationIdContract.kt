package ch.monreleve.app.contracts

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-1a R568. THE FORMAT OF THE MUTATION ID, WHATEVER THE PLATFORM MINTS IT WITH (REPORT-KMP-4 Q1): a
// lower-case, version-4 UUID in the canonical 8-4-4-4-12 form, so one id format crosses the wire. Android's
// subclass passes java.util.UUID.randomUUID().toString() (the expression AndroidRecordSeams passes);
// iOS's passes newIosMutationId().

abstract class MutationIdContract {
    protected abstract fun mint(): String

    private val shape = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")

    @Test
    fun anIdIsALowerCaseVersion4UuidInCanonicalForm() {
        repeat(200) {
            val id = mint()
            assertTrue(shape.matches(id), "not a lower-case v4 UUID: $id")
            assertEquals(id.lowercase(), id)
        }
    }

    @Test
    fun idsDoNotRepeat() {
        val ids = HashSet<String>()
        repeat(2000) { ids.add(mint()) }
        assertEquals(2000, ids.size)
    }
}
