package ch.monreleve.app.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import ch.monreleve.app.aujourdhui.AujourdhuiController
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.forecast.ForecastController
import ch.monreleve.app.forecast.ForecastState
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiActions
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreen
import ch.monreleve.app.ui.screens.prevision.PrevisionActions
import ch.monreleve.app.ui.screens.prevision.PrevisionScreen
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * AN-CALENDAR (R479). ONE RATE, ONE STRING, ON EVERY SCREEN THAT SHOWS IT.
 *
 * WHAT THIS EXISTS TO STOP, stated as the thing that happened. KMP-4 read « 0,82 % » on Aujourd'hui where the
 * forecast's « Aujourd'hui, votre relevé » read « 0,83 % » for the same record - earlier 0,40 against 0,41
 * (REPORT-KMP-4 NOTICED 2). Neither screen rounds: both truncate, as the engine's rule requires (SPEC 7.3 - Geneva
 * publishes 39,16 %, not 39,17 %). They truncate DIFFERENT NUMBERS. The forecast formats the engine's Double;
 * Aujourd'hui animated it through animateFloatAsState and formatted the Float - and 0.83 as a Float is
 * 0.829999983..., which truncates to 0,82. The same path turns Geneva's 39,16 into 39,15 on the home screen.
 *
 * SO THE TEST IS THE RECORD, NOT A NUMBER. One set of rows feeds the REAL AujourdhuiController and the REAL
 * ForecastController (R204: the entry points), each screen renders its own controller's state, and each must show
 * the engine's figure formatted once. The records are chosen for the two ways a screen can betray the rule: 1/240
 * (0,4166...: a third decimal of 5 or more, where rounding would say 0,42) and 94/240 (Geneva's published 39,16 %),
 * with 2/240 (0,83 - KMP-4's own fingerprint) between them. Aujourd'hui is also checked AFTER an animation, because a
 * figure that is right on the first frame and wrong once it has moved is the same defect, later.
 *
 * IT RUNS ON A DEVICE (connectedDebugAndroidTest); the JVM gate compiles it but does not run it.
 */
class RateOneStringInstrumentedTest {
    @get:Rule
    val composeRule = createComposeRule()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

    @After
    fun tearDown() = scope.cancel()

    private var content by mutableStateOf<@Composable () -> Unit>({})

    @Test
    fun aujourdhuiAndTheForecastShowOneStringForTheSameRecord() {
        composeRule.setContent { FrontierTheme { content() } }
        for (days in listOf(1, 2, 94)) {
            val (today, forecast) = statesFor(days)
            // The engine's figure, formatted ONCE: what every screen that shows this rate must read.
            val engine = formatPercent(requireNotNull(today.year).result.declarableRate, 2)
            if (days == 94) assertEquals("Geneva's published figure (fixtures)", "39,16 %", engine)

            content = { AujourdhuiScreen(today, AujourdhuiActions(onRecord = { _, _, _ -> })) }
            assertShows("Aujourd'hui", days, engine)
            val rail = composeRule.onAllNodesWithContentDescription(engine, substring = true).fetchSemanticsNodes()
            assertTrue("Aujourd'hui's rail does not speak $engine for $days/240", rail.isNotEmpty())

            content = { PrevisionScreen(forecast, PrevisionActions()) }
            assertShows("the forecast", days, engine)
        }
    }

    @Test
    fun aujourdhuiStillShowsTheEnginesFigureAfterTheRateHasMoved() {
        var state by mutableStateOf(statesFor(1).first)
        val actions = AujourdhuiActions(onRecord = { _, _, _ -> })
        composeRule.setContent { FrontierTheme { AujourdhuiScreen(state, actions) } }
        composeRule.waitForIdle()

        state = statesFor(2).first
        val engine = formatPercent(requireNotNull(state.year).result.declarableRate, 2)
        assertShows("Aujourd'hui after the animation", 2, engine)
    }

    private fun assertShows(
        screen: String,
        days: Int,
        expected: String,
    ) {
        composeRule.waitForIdle()
        val shown = composeRule.onAllNodesWithText(expected).fetchSemanticsNodes()
        assertTrue("$screen shows ${percentages()} for $days/240, not the engine's $expected", shown.isNotEmpty())
    }

    /** Every percentage the screen shows, for the failure message. */
    private fun percentages(): List<String> =
        composeRule.onAllNodes(androidx.compose.ui.test.SemanticsMatcher("text") { true }, useUnmergedTree = true)
            .fetchSemanticsNodes()
            .flatMap { node -> node.config.getOrNull(SemanticsProperties.Text).orEmpty().map { it.text } }
            .filter { it.contains('%') }

    /** One record - [days] of telework - read by both controllers, the way the shell builds them over one store. */
    private fun statesFor(days: Int): Pair<AujourdhuiState, ForecastState> {
        val record = Record(days)
        val aujourdhui = AujourdhuiController(record, WholeDays, 2026, JUNE_15, scope)
        val forecast = ForecastController(TwoDaysHome, record, WholeDays, 2026, JUNE_15, scope)
        return aujourdhui.state.value to forecast.state.value
    }
}

private val JUNE_15: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private object WholeDays : SettingsStore {
    override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

    override fun save(settings: Settings) = Unit

    override fun clear() = Unit
}

private object TwoDaysHome : RhythmRepository {
    override fun observe(): Flow<WeeklyRhythm> =
        flowOf(WeeklyRhythm(tuesday = RhythmKind.DOMICILE, thursday = RhythmKind.DOMICILE))

    override suspend fun save(rhythm: WeeklyRhythm) = Unit

    override suspend fun clear() = Unit
}

/** [days] whole days of telework from 1 January 2026, synced: a record, read-only. */
private class Record(days: Int) : EntryRepository {
    private val rows =
        (0 until days).map { i ->
            EntryEntity(
                clientMutationId = "m$i",
                dayDate = LocalDate.of(2026, 1, 1).plusDays(i.toLong()).toString(),
                portion = Portion.FULL,
                kind = EntryKind.HOME,
                absenceReason = null,
                note = null,
                provenance = Provenance.MANUAL,
                detectedKind = null,
                detectedAt = null,
                clientClaimedAt = null,
                serverId = "s$i",
                firstRecordedAt = null,
                lastModifiedAt = null,
                syncState = SyncState.SYNCED,
            )
        }

    override suspend fun record(command: RecordCommand): RecordResult = error("this test records nothing")

    override fun observePending(): Flow<List<EntryEntity>> = flowOf(emptyList())

    override fun observeAll(): Flow<List<EntryEntity>> = flowOf(rows)
}
