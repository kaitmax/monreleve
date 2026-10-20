package ch.monreleve.app.debug

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import androidx.room.withTransaction
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.get
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.format.DATE_TIME_ZONE
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

// DEBUG-ONLY (R284). Seeds Room with DebugSeeder's deterministic dataset, through the app's own EntryDao
// inside ONE Room transaction - the write path fence 5 blesses, not a hand-written SQLite INSERT. Declared
// ONLY in src/debug/AndroidManifest.xml, so it is absent from every release build; the two R284 guards name
// "DebugSeeder" to keep that a checked fact, and increment 3's built-APK sweep confirms it.
//
//   adb shell am start -n ch.monreleve.app/ch.monreleve.app.debug.DebugSeederActivity \
//     [--es scenario all|decade|half_day|absent|late|notes] [--es asOf 2026-09-30]
//
// scenario defaults to ALL; asOf defaults to today in Europe/Paris and fixes the anchor year (R197) so a
// scripted run can pin the dataset. The status line reports per-scenario ROW COUNTS only - never a note's
// contents (R198's shape: a screenshot of this screen leaks nothing). Re-running UPSERTs the same rows in
// place (idempotent); sign-out remains the only wipe (R295/R297).
class DebugSeederActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val status = mutableStateOf("SEEDING...")
        val scenario = scenarioFrom(intent?.getStringExtra("scenario"))
        val asOf = asOfFrom(intent?.getStringExtra("asOf"))
        setContent {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Text(text = status.value, modifier = Modifier.padding(Spacing.space20))
                }
            }
        }
        lifecycleScope.launch {
            status.value = seed(scenario, asOf)
        }
    }

    private suspend fun seed(
        scenario: SeedScenario,
        asOf: LocalDate,
    ): String {
        val db = MonReleveDatabase.get(applicationContext)
        val dao = db.entryDao()
        val counts = LinkedHashMap<String, Int>()
        val parts =
            if (scenario == SeedScenario.ALL) {
                listOf(
                    SeedScenario.DECADE,
                    SeedScenario.HALF_DAY,
                    SeedScenario.ABSENT,
                    SeedScenario.LATE,
                    SeedScenario.NOTES,
                )
            } else {
                listOf(scenario)
            }
        db.withTransaction {
            for (part in parts) {
                val rows = DebugSeeder.generate(asOf, part)
                rows.forEach { dao.upsert(it) }
                counts[part.name] = rows.size
            }
        }
        // Checkpoint the WAL into the main file so the on-disk database is self-contained - an audit tool
        // whose output cannot be read back by an external reader (adb pull + a host SQLite) is half a tool.
        db.openHelper.writableDatabase.query("PRAGMA wal_checkpoint(TRUNCATE)").use { it.moveToFirst() }
        // stored is a real SELECT back through the DAO (R233): the count of rows actually in the store, not
        // the size of the list we tried to write. generated != stored would be a silent drop worth a finding.
        val stored = dao.all().size
        val breakdown = counts.entries.joinToString(" ") { "${it.key}=${it.value}" }
        return "SEEDED anchor=${asOf.year} $breakdown generated=${counts.values.sum()} stored=$stored"
    }

    private fun scenarioFrom(raw: String?): SeedScenario =
        raw?.let { runCatching { SeedScenario.valueOf(it.uppercase()) }.getOrNull() } ?: SeedScenario.ALL

    private fun asOfFrom(raw: String?): LocalDate =
        raw?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: LocalDate.now(ZoneId.of(DATE_TIME_ZONE))
}
