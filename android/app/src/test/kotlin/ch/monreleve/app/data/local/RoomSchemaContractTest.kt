package ch.monreleve.app.data.local

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN5 increment 1. The exported Room schema IS the contract (R187), so this reads
 * the committed schemas/1.json back and pins it. It runs in the JVM gate; the
 * on-device MigrationTestHelper (MonReleveMigrationTest) validates the same schema
 * against a real database.
 *
 * A CENSUS, NOT A SPOT-CHECK. It asserts the WHOLE column set by exact equality -
 * name, affinity and nullability - plus the primary key and the version, so a
 * column added, dropped, retyped or made nullable next year goes red here rather
 * than shipping silently to a device that cannot be migrated by a deploy. The file
 * being missing is a failure, not a pass (R133): a contract test that is satisfied
 * by the absence of its subject proves nothing.
 *
 * AND A SECOND D18 GUARD, AT THE DDL LEVEL. FencesTest fence 2b scans data/local
 * source for coordinate-shaped NAMES; this asserts the generated table has no such
 * COLUMN. Two independent guards, source and schema; the plant in REPORT-AN5.txt
 * shows both fire.
 */
class RoomSchemaContractTest {
    private val schemaFile =
        File("schemas/ch.monreleve.app.data.local.MonReleveDatabase/$DATABASE_VERSION.json")

    private val database: JSONObject by lazy {
        assertTrue(
            "the exported schema is missing at ${schemaFile.absolutePath} - exportSchema must be " +
                "true and the generated JSON committed; a contract test cannot pass on an absent contract",
            schemaFile.exists(),
        )
        JSONObject(schemaFile.readText()).getJSONObject("database")
    }

    private val entryEntity: JSONObject by lazy {
        val entities = database.getJSONArray("entities")
        assertEquals("the store has exactly one table", 1, entities.length())
        entities.getJSONObject(0).also {
            assertEquals("entry", it.getString("tableName"))
        }
    }

    /** columnName -> notNull, exactly as the frozen contract stands. Every column is TEXT. */
    private val expectedColumns =
        mapOf(
            "clientMutationId" to true,
            "dayDate" to true,
            "portion" to true,
            "kind" to true,
            "absenceReason" to false,
            "note" to false,
            "provenance" to true,
            "detectedKind" to false,
            "detectedAt" to false,
            "clientClaimedAt" to false,
            "serverId" to false,
            "firstRecordedAt" to false,
            "lastModifiedAt" to false,
            "syncState" to true,
        )

    private fun actualColumns(): Map<String, Boolean> {
        val fields = entryEntity.getJSONArray("fields")
        return (0 until fields.length()).associate { index ->
            val field = fields.getJSONObject(index)
            assertEquals(
                "every column is TEXT (enums store as their name)",
                "TEXT",
                field.getString("affinity"),
            )
            field.getString("columnName") to field.optBoolean("notNull", false)
        }
    }

    @Test
    fun theSchemaVersionIsPinnedToTheCodeConstant() {
        assertEquals(DATABASE_VERSION, database.getInt("version"))
    }

    @Test
    fun everyColumnMatchesTheFrozenContract() {
        assertEquals(
            "the entry table's columns and their nullability are frozen (R187); a change here " +
                "needs a version bump and a migration, not a silent edit",
            expectedColumns,
            actualColumns(),
        )
    }

    @Test
    fun thePrimaryKeyIsDayDateThenPortion() {
        val primaryKey = entryEntity.getJSONObject("primaryKey")
        val columns = primaryKey.getJSONArray("columnNames")
        assertEquals(listOf("dayDate", "portion"), (0 until columns.length()).map { columns.getString(it) })
        assertFalse("the key is natural, not auto-generated", primaryKey.getBoolean("autoGenerate"))
    }

    @Test
    fun noColumnIsCoordinateShaped() {
        val coordinate = Regex("""(?i)\b(lat|lng|latitude|longitude|location|coord)""")
        val offenders = actualColumns().keys.filter { coordinate.containsMatchIn(it) }
        assertTrue("D18: no coordinate column may exist in the store, found $offenders", offenders.isEmpty())
    }
}
