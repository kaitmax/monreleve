package ch.monreleve.app.aujourdhui

import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.sync.entriesRequestBody
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

/**
 * AN15-AUDIT (R1131; SPEC 21 "Manual mode reaches an identical dossier to auto mode from the same days - asserted
 * by a test running both paths"; tasks/todo.md AN15 AC2). THE PHONE'S HALF.
 *
 * The phone never builds the dossier: the server does (web/lib/dossier), from the rows the phone sends, and the
 * Releve screen and the PDF render the server's figures verbatim (DossierDocument.kt, FW12). So "both modes reach
 * the same dossier" is two claims, one per side:
 *   - HERE: the manual path (AujourdhuiController.record) and the automatic path (confirmDetected /
 *     correctDetected) put the SAME bytes on the /v1 wire for the same days, apart from the three provenance
 *     fields - provenance, detectedKind, detectedAt.
 *   - web/tests/unit/dossier/mode-parity.test.tsx: from the same days the server builds a dossier, a CSV and a
 *     print document (the PDF's source) that are identical apart from the provenance strings.
 *
 * WHAT IS COMPARED IS THE REQUEST BODY the sync engine sends (entriesRequestBody, the one encoder SyncEngine uses),
 * built from the rows that REACHED the DAO (R133) - not the objects the controller returned.
 *
 * Every day is recorded by a controller whose clock stands on that day's evening, as a person would tap it: the
 * controller files "today" from its clock (F8), and the repository writes the device's claim from the same clock.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ModeParityTest {
    private val settings: SettingsStore =
        object : SettingsStore {
            override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "HALF_DAY", null)

            override fun save(settings: Settings) = Unit

            override fun clear() = Unit
        }

    /** One tap: the day, what it records, and how the automatic person reached the same record. */
    private data class Tap(
        val day: String,
        val kind: RecordedKind,
        val slot: Slot = Slot.FULL,
        val absence: AbsenceChoice? = null,
        /** What detection proposed; null = the automatic person recorded this one by hand too (MANUAL). */
        val proposed: RecordedKind? = null,
    )

    // A working fortnight covering every kind, both halves, an absence with its reason, a confirmed and a
    // corrected proposal of each side, and a day the automatic person records by hand (detection proposes only
    // CH/HOME, so missions and absences arrive by correction or by hand).
    private val days =
        listOf(
            Tap("2026-03-02", RecordedKind.SUISSE, proposed = RecordedKind.SUISSE),
            Tap("2026-03-03", RecordedKind.DOMICILE, proposed = RecordedKind.DOMICILE),
            Tap("2026-03-04", RecordedKind.SUISSE, proposed = RecordedKind.DOMICILE),
            Tap("2026-03-05", RecordedKind.DOMICILE, proposed = RecordedKind.SUISSE),
            Tap("2026-03-06", RecordedKind.MISSION_FRANCE, proposed = RecordedKind.SUISSE),
            Tap("2026-03-09", RecordedKind.ABSENCE, absence = AbsenceChoice.MALADIE, proposed = RecordedKind.DOMICILE),
            Tap("2026-03-10", RecordedKind.SUISSE, Slot.MORNING, proposed = RecordedKind.SUISSE),
            Tap("2026-03-10", RecordedKind.DOMICILE, Slot.AFTERNOON, proposed = RecordedKind.DOMICILE),
            Tap("2026-03-11", RecordedKind.MISSION_THIRD),
            Tap("2026-03-12", RecordedKind.ABSENCE, absence = AbsenceChoice.CONGE),
        )

    // 19:30 Paris in March (+01:00): after the last check window, when the evening proposal is shown.
    private fun eveningOf(day: String): Clock =
        Clock.fixed(Instant.parse("${day}T18:30:00Z"), ZoneId.of("Europe/Paris"))

    /** Record every day through ONE mode's path and return the request body the sync engine would send. */
    private suspend fun TestScope.wireOf(mode: LoggingMode): Pair<String, Int> {
        val dao = FakeEntryDao()
        var minted = 0
        for (tap in days) {
            val clock = eveningOf(tap.day)
            val repository =
                LocalEntryRepository(
                    dao,
                    clock,
                    currentAccount = { "acct-parity" },
                    newMutationId = { "mut-${++minted}" },
                )
            val controller =
                AujourdhuiController(
                    repository,
                    settings,
                    2026,
                    clock,
                    this as CoroutineScope,
                    detectionModeStore = InMemoryDetectionModeStore(mode),
                )
            when {
                mode == LoggingMode.MANUAL || tap.proposed == null -> controller.record(tap.kind, tap.slot, tap.absence)
                tap.proposed == tap.kind -> controller.confirmDetected(tap.kind, tap.slot)
                else -> controller.correctDetected(tap.kind, tap.slot, tap.absence, proposedKind = tap.proposed)
            }
            advanceUntilIdle()
        }
        val rows = dao.all()
        return entriesRequestBody(rows) to rows.size
    }

    /** The provenance fields, removed: provenance is never first, and the three are strings whenever present. */
    private fun withoutProvenance(body: String): String =
        body.replace(Regex(""","(provenance|detectedKind|detectedAt)":"[^"]*""""), "")

    @Test
    fun bothModesSendTheSameBytesApartFromTheProvenanceFields() =
        runTest {
            val (manual, manualRows) = wireOf(LoggingMode.MANUAL)
            val (automatic, automaticRows) = wireOf(LoggingMode.AUTO_DETECT)

            // PRESENCE FIRST (R169's corollary): every tap reached the DAO in both modes, so the equality below
            // compares ten rows each, not two empty lists.
            assertEquals(days.size, manualRows, "every manual tap is a row")
            assertEquals(days.size, automaticRows, "every automatic tap is a row")

            // NOT VACUOUS: the automatic body really carries detected provenance, so the stripping below removes
            // something real. If both bodies were already equal, the paths would not be different paths.
            assertNotEquals(manual, automatic, "the two paths differ - in their provenance")
            assertEquals(days.count { it.proposed == null }, Regex("\"MANUAL\"").findAll(automatic).count())
            assertEquals(
                days.count { it.proposed != null && it.proposed == it.kind },
                Regex("\"DETECTED_CONFIRMED\"").findAll(automatic).count(),
            )
            assertEquals(
                days.count { it.proposed != null && it.proposed != it.kind },
                Regex("\"DETECTED_CORRECTED\"").findAll(automatic).count(),
            )
            assertEquals(days.size, Regex("\"MANUAL\"").findAll(manual).count(), "the manual path writes MANUAL only")

            // THE CLAIM: byte for byte, once the provenance fields are taken out of both.
            assertEquals(withoutProvenance(manual), withoutProvenance(automatic))
        }
}
