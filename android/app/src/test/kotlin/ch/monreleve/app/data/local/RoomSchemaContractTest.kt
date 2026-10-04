package ch.monreleve.app.data.local

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN5 increment 1 / AN6a increment 3. The exported Room schema IS the contract (R187), so this
 * reads the committed schemas/<version>.json back and pins it - now over BOTH tables (entry,
 * daily_tally). It runs in the JVM gate; the on-device MigrationTestHelper validates the same
 * schema and the 1->2 migration against a real database.
 *
 * A CENSUS, NOT A SPOT-CHECK. It asserts each table's WHOLE column set by exact equality -
 * name, affinity and nullability - plus the primary keys and the version, so a column added,
 * dropped, retyped or made nullable goes red here rather than shipping to a device that cannot
 * be migrated by a deploy. A missing file is a failure, not a pass (R133).
 *
 * AND THE D18 GUARD, AT THE DDL LEVEL, OVER EVERY TABLE. FencesTest fence 2b scans data/local
 * source for coordinate-shaped NAMES; this asserts NO table has a coordinate COLUMN - iterating
 * all entities, because the tally table this increment adds is exactly the one that must not
 * grow a latitude. The plant in REPORT-AN6a.txt shows it fires.
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

    private fun entities(): Map<String, JSONObject> {
        val array = database.getJSONArray("entities")
        return (0 until array.length()).associate { index ->
            val entity = array.getJSONObject(index)
            entity.getString("tableName") to entity
        }
    }

    private fun columnsOf(entity: JSONObject): Map<String, Pair<String, Boolean>> {
        val fields = entity.getJSONArray("fields")
        return (0 until fields.length()).associate { index ->
            val field = fields.getJSONObject(index)
            field.getString("columnName") to (field.getString("affinity") to field.optBoolean("notNull", false))
        }
    }

    // tableName -> (columnName -> affinity to notNull), the frozen contract for both tables.
    private val expectedSchema =
        mapOf(
            "entry" to
                mapOf(
                    "clientMutationId" to ("TEXT" to true),
                    "dayDate" to ("TEXT" to true),
                    "portion" to ("TEXT" to true),
                    "kind" to ("TEXT" to true),
                    "absenceReason" to ("TEXT" to false),
                    "note" to ("TEXT" to false),
                    "provenance" to ("TEXT" to true),
                    "detectedKind" to ("TEXT" to false),
                    "detectedAt" to ("TEXT" to false),
                    "clientClaimedAt" to ("TEXT" to false),
                    "serverId" to ("TEXT" to false),
                    "firstRecordedAt" to ("TEXT" to false),
                    "lastModifiedAt" to ("TEXT" to false),
                    "syncState" to ("TEXT" to true),
                    // AN-FIX F4 / R303: the local-only account tag, part of the primary key (v3).
                    "accountTag" to ("TEXT" to true),
                ),
            // R320: the four daily checks replace the continuous minutes tally. Each slot is a Classification
            // name or NULL (MISSED); the tier is derived by the vote, never stored. No coordinate column.
            // AN-NEXT-2 / R324: the provider COUNTS (gpsCheckCount, networkCheckCount) - INTEGER NOT NULL, how
            // many of the day's checks came from GPS vs the NETWORK fallback. Counts only; still no coordinate
            // and no accuracy column (noColumnIsCoordinateShapedInAnyTable proves it over every table).
            "daily_tally" to
                mapOf(
                    "dayDate" to ("TEXT" to true),
                    "check1" to ("TEXT" to false),
                    "check2" to ("TEXT" to false),
                    "check3" to ("TEXT" to false),
                    "check4" to ("TEXT" to false),
                    "gpsCheckCount" to ("INTEGER" to true),
                    "networkCheckCount" to ("INTEGER" to true),
                ),
        )

    @Test
    fun theSchemaVersionIsPinnedToTheCodeConstant() {
        assertEquals(DATABASE_VERSION, database.getInt("version"))
    }

    @Test
    fun theStoreHasExactlyTheExpectedTables() {
        assertEquals(expectedSchema.keys, entities().keys)
    }

    @Test
    fun everyColumnMatchesTheFrozenContract() {
        val entities = entities()
        for ((table, expected) in expectedSchema) {
            val entity = entities[table] ?: error("table $table is missing from the exported schema")
            assertEquals(
                "$table's columns, affinities and nullability are frozen (R187); a change needs a " +
                    "version bump and a migration, not a silent edit",
                expected,
                columnsOf(entity),
            )
        }
    }

    @Test
    fun primaryKeysAreAsFrozen() {
        val expectedKeys =
            mapOf(
                // AN-FIX F4 / R303: accountTag joins the entry key, mirroring @@unique([userId, dayDate, portion]).
                "entry" to listOf("accountTag", "dayDate", "portion"),
                "daily_tally" to listOf("dayDate"),
            )
        val entities = entities()
        for ((table, expected) in expectedKeys) {
            val primaryKey = entities.getValue(table).getJSONObject("primaryKey")
            val columns = primaryKey.getJSONArray("columnNames")
            assertEquals("$table primary key", expected, (0 until columns.length()).map { columns.getString(it) })
            assertFalse("$table key is natural, not auto-generated", primaryKey.getBoolean("autoGenerate"))
        }
    }

    @Test
    fun noColumnIsCoordinateShapedInAnyTable() {
        val coordinate = Regex("""(?i)\b(lat|lng|latitude|longitude|location|coord|geo)""")
        val offenders =
            entities().flatMap { (table, entity) ->
                columnsOf(entity).keys.filter { coordinate.containsMatchIn(it) }.map { "$table.$it" }
            }
        assertTrue("D18: no coordinate column may exist in any table, found $offenders", offenders.isEmpty())
    }
}
