package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import ch.monreleve.app.calendar.CalendarController
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Rule
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/**
 * AN-CALENDAR (R474, R473). THE TAP THAT WROTE NOTHING, AND THE CHANGE THAT WAS UNDONE.
 *
 * R474 - REPRODUCING AN-POLISH N1. "Opening 19.10.2026 and tapping 'Domicile' under 'Matin' left the sheet unchanged
 * and wrote NO row" (REPORT-AN-POLISH.txt, N1). It was driven by uidrive.mjs, which reads the ACCESSIBILITY TREE
 * (uiautomator dump: text, content-desc, bounds). The sheet's options were a filled Button when chosen and an
 * OutlinedButton when not - a difference of PAINT, with nothing in the semantics tree. So the tree after the tap was
 * the tree before it: "unchanged" was literally true of what the driver could see, and of what TalkBack can say.
 * And no row was written because a kind tap in the sheet only CHOOSES (D16 - « Enregistrer » is the one writer);
 * the sheet's save path itself writes, which KMP-4's trail shows (its MODIFIED events came from this sheet).
 *
 * THE FIRST TEST IS THAT CASE: the same account shape (half days), a past working day with nothing recorded, the
 * « Matin » section's « Domicile ». It asserts the tap is VISIBLE in the tree, that nothing is written before
 * « Enregistrer », and that « Enregistrer » then writes exactly the morning.
 *
 * R473's FOURTH CASE LIVES HERE because it is a property of the sheet's DRAFT: a change undone before saving reaches
 * save() as the stored value, so only a test that drives the draft can show it. On main it wrote BOTH halves.
 *
 * IT DRIVES THE REAL SHEET, THE REAL CONTROLLER AND THE REAL REPOSITORY (R204: the entry point is the unit under
 * test); only the DAO is in memory, and it is LIVE (a StateFlow), so the controller observes its own writes the way
 * it observes Room's. IT RUNS ON A DEVICE (connectedDebugAndroidTest), which the JVM gate COMPILES but does not run.
 */
class CalendarSheetSaveInstrumentedTest {
    @get:Rule
    val composeRule = createComposeRule()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

    @After
    fun tearDown() = scope.cancel()

    @Test
    fun aTapOnDomicileUnderMatinIsAChoiceTheTreeShowsAndNothingIsWrittenUntilEnregistrer() {
        val rig = Rig(scope, seed = emptyList())
        composeRule.setContent { Sheet(rig.controller) }

        // The sheet lists « Matin » first, so the first « Domicile » is the morning's (CalendarEditSheet's order).
        val before = selectedOf(0)
        composeRule.onAllNodesWithText(AujourdhuiCopy.DOMICILE)[0].performClick()
        composeRule.waitForIdle()

        // AN-POLISH's observation, as an assertion: the tap must change what the accessibility tree says.
        assertNotEquals("the tap left the accessibility tree unchanged - AN-POLISH N1", before, selectedOf(0))
        composeRule.onAllNodesWithText(AujourdhuiCopy.DOMICILE)[0].assertIsSelected()
        composeRule.onAllNodesWithText(AujourdhuiCopy.DOMICILE)[1].assertIsNotSelected()
        assertEquals("a kind tap chooses; only « Enregistrer » writes (D16)", emptyList<EntryEntity>(), rig.writes())

        composeRule.onNodeWithText(CalendarCopy.SHEET_SAVE).performScrollTo().performClick()
        composeRule.waitForIdle()

        assertEquals(listOf(Portion.AM to EntryKind.HOME), rig.writes().map { it.portion to it.kind })
        assertEquals(1, rig.syncRequests)
    }

    @Test
    fun changingTheMorningAndChangingItBackBeforeSavingWritesNothing() {
        val rig = Rig(scope, seed = listOf(half(EntryKind.HOME, Portion.AM), half(EntryKind.HOME, Portion.PM)))
        composeRule.setContent { Sheet(rig.controller) }

        composeRule.onAllNodesWithText(AujourdhuiCopy.SUISSE)[0].performClick()
        composeRule.onAllNodesWithText(AujourdhuiCopy.DOMICILE)[0].performClick()
        composeRule.onNodeWithText(CalendarCopy.SHEET_SAVE).performScrollTo().performClick()
        composeRule.waitForIdle()

        assertEquals("a change undone before saving is no change (R473)", emptyList<EntryEntity>(), rig.writes())
        assertEquals("nothing to send, so no sync is asked for", 0, rig.syncRequests)
    }

    @Test
    fun aRealChangeMadeInTheSheetIsWrittenForThatHalfAlone() {
        val rig = Rig(scope, seed = listOf(half(EntryKind.HOME, Portion.AM), half(EntryKind.HOME, Portion.PM)))
        composeRule.setContent { Sheet(rig.controller) }

        // The second « En Suisse » is the afternoon's.
        composeRule.onAllNodesWithText(AujourdhuiCopy.SUISSE)[1].performScrollTo().performClick()
        composeRule.onNodeWithText(CalendarCopy.SHEET_SAVE).performScrollTo().performClick()
        composeRule.waitForIdle()

        assertEquals(listOf(Portion.PM to EntryKind.CH), rig.writes().map { it.portion to it.kind })
        assertEquals(1, rig.syncRequests)
    }

    /** The Selected property of the n-th « Domicile » node, or null when the tree carries none (main's sheet). */
    private fun selectedOf(index: Int): Boolean? =
        composeRule.onAllNodesWithText(AujourdhuiCopy.DOMICILE)[index]
            .fetchSemanticsNode()
            .config
            .getOrNull(SemanticsProperties.Selected)

    @Composable
    private fun Sheet(controller: CalendarController) {
        val state by controller.state.collectAsState()
        FrontierTheme {
            state.editing?.let { day ->
                CalendarEditSheetContent(
                    day = day,
                    onSave = { edits -> controller.save(day.isoDate, edits) },
                    onCancel = controller::closeSheet,
                )
            }
        }
    }
}

/** A past working day (a Wednesday) relative to [JUNE_15], so the sheet opens on it. */
private const val DAY = "2026-06-10"

private val JUNE_15: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private fun half(
    kind: EntryKind,
    portion: Portion,
) = RecordCommand(dayDate = DAY, kind = kind, portion = portion)

/** The calendar over [DAY] in half-day mode, seeded BEFORE the controller exists, its sheet open. */
private class Rig(
    scope: CoroutineScope,
    seed: List<RecordCommand>,
) {
    private val dao = LiveEntryDao()
    private val seeded: Int
    var syncRequests = 0
    val controller: CalendarController

    init {
        val repository = LocalEntryRepository(dao, JUNE_15)
        runBlocking { seed.forEach { repository.record(it) } }
        seeded = dao.upserts.size
        val halfDays =
            object : SettingsStore {
                override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "HALF_DAY", null)

                override fun save(settings: Settings) = Unit

                override fun clear() = Unit
            }
        controller = CalendarController(repository, halfDays, 2026, JUNE_15, scope, requestSync = { syncRequests += 1 })
        controller.openDay(DAY)
    }

    /** Every row written AFTER the seed - the sheet's writes, and nothing else. */
    fun writes(): List<EntryEntity> = dao.upserts.drop(seeded)
}

/** An in-memory EntryDao that is LIVE, like Room's: a write re-emits every observing query. */
private class LiveEntryDao : EntryDao {
    private val rows = MutableStateFlow<Map<Triple<String, String, Portion>, EntryEntity>>(emptyMap())
    val upserts = mutableListOf<EntryEntity>()

    override suspend fun upsert(entry: EntryEntity) {
        upserts += entry
        rows.value = rows.value + (Triple(entry.accountTag, entry.dayDate, entry.portion) to entry)
    }

    override suspend fun byDayPortion(
        dayDate: String,
        portion: Portion,
    ): EntryEntity? = rows.value.values.firstOrNull { it.dayDate == dayDate && it.portion == portion }

    override suspend fun byAccountDayPortion(
        accountTag: String,
        dayDate: String,
        portion: Portion,
    ): EntryEntity? = rows.value[Triple(accountTag, dayDate, portion)]

    override suspend fun pendingForAccount(accountTag: String): List<EntryEntity> =
        rows.value.values.filter { it.accountTag == accountTag && it.syncState == SyncState.PENDING }

    override fun observeAllForAccount(accountTag: String): Flow<List<EntryEntity>> =
        rows.map { all -> all.values.filter { it.accountTag == accountTag } }

    override suspend fun all(): List<EntryEntity> = rows.value.values.toList()

    override suspend fun pending(): List<EntryEntity> = rows.value.values.filter { it.syncState == SyncState.PENDING }

    override fun observePending(): Flow<List<EntryEntity>> =
        rows.map { all -> all.values.filter { it.syncState == SyncState.PENDING } }

    override fun observeAll(): Flow<List<EntryEntity>> = rows.map { it.values.toList() }
}
