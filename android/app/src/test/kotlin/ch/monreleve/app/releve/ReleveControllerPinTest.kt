package ch.monreleve.app.releve

import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.remote.ExportBytes
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.DossierPeriod
import ch.monreleve.app.dossier.DossierTiles
import ch.monreleve.app.dossier.DossierZone
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertSame
import kotlin.test.fail

// IOS-2c R788. THE RELEVE CONTROLLER'S PIN, written and run green in :app against the controller as it stood, BEFORE
// it moved to :shared - then moved to commonTest by `git mv`, unedited (R768's shape). kotlin.test +
// kotlinx-coroutines-test only. The fetch and the export are scripted seams that LOG what they were asked, so the
// same requests in the same order are asserted. ReleveControllerTest, ReleveFreshTest and ReleveViewTest (Kotest)
// stay in :app, unedited.
//
// Pinned: the server's document carried verbatim with the year's rules; every fetch outcome's state; the past-year
// probe and the year switch; each export outcome and its path; the stale copy shown updating then replaced (and
// kept, dated or flagged, when the refresh fails); the pending count following the rows; the restored year.
@OptIn(ExperimentalCoroutinesApi::class)
class ReleveControllerPinTest {
    private class Rows(seed: List<EntryEntity>) : EntryRepository {
        val all = MutableStateFlow(seed)

        override suspend fun record(command: RecordCommand): RecordResult = fail("the releve records nothing")

        override fun observePending(): Flow<List<EntryEntity>> =
            all.map { rows -> rows.filter { it.syncState == SyncState.PENDING } }

        override fun observeAll(): Flow<List<EntryEntity>> = all
    }

    private class Built(val controller: ReleveController, val rows: Rows) {
        val fetches = mutableListOf<Int>()
        val exports = mutableListOf<String>()
    }

    private fun document(
        year: Int = 2026,
        recorded: Int = 5,
        generatedAt: String = "2026-06-18T18:04:00.000Z",
    ): DossierDocument =
        DossierDocument(
            taxYear = year,
            period = DossierPeriod(fraction = 1.0, startDate = null),
            titulaire = "Camille Rey",
            generatedAt = generatedAt,
            canton = "GE",
            employmentRate = 100,
            denominatorKind = "SIMPLIFIED240",
            tiles = DossierTiles(workedDays = 240.0, swissDays = 75.0, teleworkDays = 43.0, missionDays = 1.0),
            zone =
                DossierZone(
                    declarableRate = 42.70,
                    rawRate = 43.60,
                    ratesDiffer = true,
                    fiscalCeilingDays = 96.0,
                    remainingToFiscal = 5.5,
                    remainingToSocial = 20.0,
                    warnings = emptyList(),
                ),
            months = emptyList(),
            annex = emptyList(),
            absenceDays = 3.0,
            recordedEntries = recorded,
            creditedMissionDays = 1.0,
            rateWithoutMissions = 42.29,
        )

    private fun entry(
        day: String,
        state: SyncState,
    ) = EntryEntity(
        clientMutationId = "$day-$state",
        dayDate = day,
        portion = Portion.FULL,
        kind = EntryKind.HOME,
        absenceReason = null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = null,
        firstRecordedAt = null,
        lastModifiedAt = null,
        syncState = state,
    )

    private fun rulesOf(year: Int): ReleveRules {
        val r = ruleSetFor(year)
        return ReleveRules(r.fiscalCeiling, r.socialCeiling, r.simplifiedBasisDays, r.missionCapDays)
    }

    // One parameter per scripted seam of the controller, each defaulted; `advance` lets a test read the state the
    // constructor sets before any coroutine runs (the stale copy shown updating).
    @Suppress("LongParameterList")
    private fun TestScope.build(
        fetch: (Int) -> DossierResult,
        export: (String) -> BytesOutcome = { BytesOutcome.NetworkError },
        seed: List<EntryEntity> = emptyList(),
        restoredYear: Int? = null,
        stale: (Int) -> DossierDocument? = { null },
        advance: Boolean = true,
    ): Built {
        val rows = Rows(seed)
        lateinit var built: Built
        val controller =
            ReleveController(
                fetch = { year ->
                    built.fetches += year
                    fetch(year)
                },
                exportBytes = { path ->
                    built.exports += path
                    export(path)
                },
                repository = rows,
                taxYear = 2026,
                // backgroundScope: the controller observes the rows forever; the test's end cancels it.
                scope = backgroundScope,
                restoredSelectedYear = restoredYear,
                staleCopy = stale,
            )
        built = Built(controller, rows)
        if (advance) runCurrent()
        return built
    }

    @Test
    fun theServersDocumentIsCarriedVerbatimWithTheYearsRules() =
        runTest {
            val doc = document()
            val built =
                build(
                    fetch = { year -> DossierResult.Loaded(if (year == 2026) doc else document(year, 0)) },
                    seed =
                        listOf(
                            entry("2026-06-01", SyncState.PENDING),
                            entry("2026-06-02", SyncState.PENDING),
                            entry("2026-06-03", SyncState.SYNCED),
                            entry("2025-12-01", SyncState.PENDING),
                        ),
                )
            assertEquals(listOf(2026, 2025), built.fetches)
            val state = built.controller.state.value
            assertEquals(
                ReleveState.Loaded(
                    document = doc,
                    rules = rulesOf(2026),
                    pendingCount = 2,
                    offline = false,
                    selectedYear = 2026,
                    availableYears = listOf(2026),
                    isCurrentYear = true,
                ),
                state,
            )
            assertSame(doc, (state as ReleveState.Loaded).document)
            // R287: a pending day draining lowers the count with no refetch
            built.rows.all.value =
                listOf(entry("2026-06-01", SyncState.PENDING), entry("2026-06-02", SyncState.SYNCED))
            runCurrent()
            assertEquals(1, (built.controller.state.value as ReleveState.Loaded).pendingCount)
            assertEquals(listOf(2026, 2025), built.fetches)
        }

    @Test
    fun everyFetchOutcomeHasItsState() =
        runTest {
            mapOf(
                DossierResult.Unreadable to ReleveState.Failed(ReleveError.SERVER),
                DossierResult.SessionExpired to ReleveState.Failed(ReleveError.SESSION_EXPIRED),
                DossierResult.SessionEnded to ReleveState.Failed(ReleveError.SESSION_ENDED),
                DossierResult.NoSession to ReleveState.Failed(ReleveError.NO_SESSION),
                DossierResult.NetworkError to ReleveState.Failed(ReleveError.NETWORK),
            ).forEach { (result, expected) ->
                assertEquals(expected, build(fetch = { result }).controller.state.value, "$result")
            }
            val cached = document(generatedAt = "2026-06-01T08:00:00.000Z")
            assertEquals(
                ReleveState.Loaded(cached, rulesOf(2026), 0, offline = true),
                build(fetch = { year -> if (year == 2026) DossierResult.Cached(cached) else DossierResult.Unreadable })
                    .controller.state.value,
            )
            // a retry fetches again
            val built = build(fetch = { DossierResult.NetworkError })
            built.controller.load()
            runCurrent()
            assertEquals(listOf(2026, 2025, 2026), built.fetches)
        }

    @Test
    fun aPastYearWithDaysIsOfferedAndSwitchedTo() =
        runTest {
            val past = document(2025, recorded = 3)
            val built =
                build(
                    fetch = { year -> DossierResult.Loaded(if (year == 2025) past else document()) },
                    seed = listOf(entry("2026-06-01", SyncState.PENDING), entry("2025-06-15", SyncState.PENDING)),
                )
            val c = built.controller
            assertEquals(listOf(2026, 2025), (c.state.value as ReleveState.Loaded).availableYears)
            c.selectYear(2024) // not offered: nothing
            c.selectYear(2026) // already shown: nothing
            runCurrent()
            assertEquals(listOf(2026, 2025), built.fetches)
            c.selectYear(2025)
            runCurrent()
            assertEquals(listOf(2026, 2025, 2025), built.fetches)
            assertEquals(2025, c.selectedYear.value)
            assertEquals(
                ReleveState.Loaded(past, rulesOf(2025), 1, false, 2025, listOf(2026, 2025), isCurrentYear = false),
                c.state.value,
            )
            c.export(ExportKind.PDF)
            runCurrent()
            assertEquals(listOf("/api/v1/export/pdf?year=2025"), built.exports)
        }

    @Test
    fun eachExportOutcomeBecomesItsEvent() =
        runTest {
            val pdf = byteArrayOf(1, 2, 3)
            val csv = byteArrayOf(4, 5)
            val outcomes =
                ArrayDeque(
                    listOf(
                        BytesOutcome.Ok(200, ExportBytes(pdf, null)),
                        BytesOutcome.Ok(299, ExportBytes(csv, "releve-camille-2026.csv")),
                        BytesOutcome.Ok(300, ExportBytes(pdf, null)),
                        BytesOutcome.Ok(503, ExportBytes(pdf, null)),
                        BytesOutcome.NetworkError,
                        BytesOutcome.SessionExpired,
                        BytesOutcome.SessionEnded,
                        BytesOutcome.NoSession,
                    ),
                )
            val built = build(fetch = { DossierResult.Loaded(document()) }, export = { outcomes.removeFirst() })
            val events = mutableListOf<ExportEvent>()
            backgroundScope.launch { built.controller.exportEvents.collect { events += it } }
            listOf(
                ExportKind.PDF,
                ExportKind.CSV,
                ExportKind.PDF,
                ExportKind.CSV,
                ExportKind.PDF,
                ExportKind.PDF,
                ExportKind.CSV,
                ExportKind.PDF,
            ).forEach {
                built.controller.export(it)
                runCurrent()
            }
            assertEquals(
                listOf(
                    "/api/v1/export/pdf?year=2026",
                    "/api/v1/export/csv?year=2026",
                    "/api/v1/export/pdf?year=2026",
                    "/api/v1/export/csv?year=2026",
                    "/api/v1/export/pdf?year=2026",
                    "/api/v1/export/pdf?year=2026",
                    "/api/v1/export/csv?year=2026",
                    "/api/v1/export/pdf?year=2026",
                ),
                built.exports,
            )
            assertEquals(
                listOf(
                    ExportEvent.Ready(pdf, "releve-2026.pdf", "application/pdf"),
                    ExportEvent.Ready(csv, "releve-camille-2026.csv", "text/csv"),
                    ExportEvent.Failed,
                    ExportEvent.Failed,
                    ExportEvent.RequiresConnectivity,
                    ExportEvent.Failed,
                    ExportEvent.Failed,
                    ExportEvent.Failed,
                ),
                events,
            )
        }

    @Test
    fun aStaleCopyOpensUpdatingAndTheServerReplacesIt() =
        runTest {
            val copy = document(generatedAt = "2026-06-10T08:00:00.000Z")
            val server = document(generatedAt = "2026-06-18T18:04:00.000Z")
            val built =
                build(
                    fetch = { year -> DossierResult.Loaded(if (year == 2026) server else document(year, 0)) },
                    stale = { year -> if (year == 2026) copy else null },
                    advance = false,
                )
            assertEquals(
                ReleveState.Loaded(copy, rulesOf(2026), 0, false, updating = true),
                built.controller.state.value,
            )
            runCurrent()
            assertEquals(listOf(2026, 2025), built.fetches)
            assertEquals(ReleveState.Loaded(server, rulesOf(2026), 0, false), built.controller.state.value)
            // what a failed refresh ends on: the copy dated, the copy flagged, or the session's own state
            mapOf(
                DossierResult.NetworkError to ReleveState.Loaded(copy, rulesOf(2026), 0, offline = true),
                DossierResult.Unreadable to ReleveState.Loaded(copy, rulesOf(2026), 0, false, refreshFailed = true),
                DossierResult.SessionExpired to ReleveState.Failed(ReleveError.SESSION_EXPIRED),
            ).forEach { (result, expected) ->
                val failed = build(fetch = { result }, stale = { year -> if (year == 2026) copy else null })
                assertEquals(expected, failed.controller.state.value, "$result")
            }
        }

    @Test
    fun openingTheTabRefreshesOnlyAStaleYear() =
        runTest {
            var copy: DossierDocument? = null
            val server = document()
            val built = build(fetch = { DossierResult.Loaded(server) }, stale = { copy })
            built.controller.onOpened()
            runCurrent()
            assertEquals(listOf(2026, 2025), built.fetches) // nothing stale: no fetch
            built.controller.onClosed()
            copy = document(generatedAt = "2026-06-10T08:00:00.000Z")
            built.controller.onOpened()
            assertEquals(true, (built.controller.state.value as ReleveState.Loaded).updating)
            runCurrent()
            assertEquals(listOf(2026, 2025, 2026), built.fetches)
        }

    @Test
    fun aRestoredYearIsTheFirstFetched() =
        runTest {
            val built = build(fetch = { year -> DossierResult.Loaded(document(year)) }, restoredYear = 2025)
            assertEquals(listOf(2025, 2025), built.fetches)
            assertEquals(2025, built.controller.selectedYear.value)
            assertEquals(false, (built.controller.state.value as ReleveState.Loaded).isCurrentYear)
        }
}
