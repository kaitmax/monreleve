package ch.monreleve.app.releve

import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.remote.ExportBytes
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.DossierPeriod
import ch.monreleve.app.dossier.DossierTiles
import ch.monreleve.app.dossier.DossierZone
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest

// AN11 increments 1-2. The controller carries the SERVER's document to the screen and recomputes nothing
// (FW12): a Loaded fetch becomes ReleveState.Loaded holding the SAME document instance, with the two
// ceilings read from the year's RuleSet. Each failure maps to the state that shows the right sentence (R210
// distinguishes an expiry from a replay). R287: the pending count is the device's PENDING rows for the year.

private const val TAX_YEAR = 2026

private fun document(): DossierDocument =
    DossierDocument(
        taxYear = TAX_YEAR,
        period = DossierPeriod(fraction = 1.0, startDate = null),
        titulaire = "Camille Rey",
        generatedAt = "2026-06-18T18:04:00.000Z",
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
        recordedEntries = 5,
        creditedMissionDays = 1.0,
        rateWithoutMissions = 42.29,
    )

private fun entry(
    dayDate: String,
    syncState: SyncState,
): EntryEntity =
    EntryEntity(
        clientMutationId = "$dayDate-${syncState.name}",
        dayDate = dayDate,
        portion = Portion.FULL,
        kind = EntryKind.HOME,
        absenceReason = null,
        note = null,
        provenance = ch.monreleve.app.data.local.Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = null,
        firstRecordedAt = null,
        lastModifiedAt = null,
        syncState = syncState,
    )

/** A repository that emits a fixed set of rows. The controller reads observeAll() for the pending count. */
private fun repoOf(vararg entries: EntryEntity): EntryRepository =
    object : EntryRepository {
        override suspend fun record(command: RecordCommand): EntryEntity = error("unused in this test")

        // The controller reads the pending count from observeAll(); observePending() is unused here.
        override fun observePending(): Flow<List<EntryEntity>> = flowOf(emptyList())

        override fun observeAll(): Flow<List<EntryEntity>> = flowOf(entries.toList())
    }

@OptIn(ExperimentalCoroutinesApi::class)
class ReleveControllerTest : FunSpec({
    test("a loaded fetch carries the server's document verbatim, with the year's ceilings (R181)") {
        runTest {
            val doc = document()
            val controller =
                ReleveController(
                    fetch = { DossierResult.Loaded(doc) },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()

            val loaded = controller.state.value.shouldBeInstanceOf<ReleveState.Loaded>()
            // The SAME instance - nothing was rebuilt or recomputed on the way through.
            (loaded.document === doc) shouldBe true
            loaded.pendingCount shouldBe 0
            loaded.offline shouldBe false
            // 2026's RuleSet: 40 % / 49,9 % as fractions, and the 240-day simplified basis - read, not typed.
            loaded.rules.fiscalCeiling shouldBe 0.4
            loaded.rules.socialCeiling shouldBe 0.499
            loaded.rules.simplifiedBasisDays shouldBe 240
        }
    }

    test("R287: the pending count is the device's PENDING rows for this year, and nothing else") {
        runTest {
            val repo =
                repoOf(
                    entry("2026-06-15", SyncState.PENDING),
                    entry("2026-06-16", SyncState.PENDING),
                    // Excluded: already synced, refused (FAILED is not "pas encore"), and another year.
                    entry("2026-06-17", SyncState.SYNCED),
                    entry("2026-06-18", SyncState.FAILED),
                    entry("2025-06-15", SyncState.PENDING),
                )
            val controller =
                ReleveController(
                    fetch = { DossierResult.Loaded(document()) },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repo,
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()

            val loaded = controller.state.value.shouldBeInstanceOf<ReleveState.Loaded>()
            loaded.pendingCount shouldBe 2
        }
    }

    test("R288: a cached fetch is Loaded but marked offline, so the screen dates it") {
        runTest {
            val doc = document()
            val controller =
                ReleveController(
                    fetch = { DossierResult.Cached(doc) },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()

            val loaded = controller.state.value.shouldBeInstanceOf<ReleveState.Loaded>()
            (loaded.document === doc) shouldBe true
            loaded.offline shouldBe true
        }
    }

    test("a network failure is Failed(NETWORK), offering a retry rather than a blank screen") {
        runTest {
            val controller =
                ReleveController(
                    fetch = { DossierResult.NetworkError },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            controller.state.value shouldBe ReleveState.Failed(ReleveError.NETWORK)
        }
    }

    test("an unreadable response is Failed(SERVER)") {
        runTest {
            val controller =
                ReleveController(
                    fetch = { DossierResult.Unreadable },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            controller.state.value shouldBe ReleveState.Failed(ReleveError.SERVER)
        }
    }

    test("an expiry and a replay map to different states, so their copy can differ (R210)") {
        runTest {
            val expired =
                ReleveController(
                    fetch = { DossierResult.SessionExpired },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            expired.state.value shouldBe ReleveState.Failed(ReleveError.SESSION_EXPIRED)

            val ended =
                ReleveController(
                    fetch = { DossierResult.SessionEnded },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            ended.state.value shouldBe ReleveState.Failed(ReleveError.SESSION_ENDED)
        }
    }

    test("AC2/R237: a 200 export emits Ready with the server's filename and the right mime, at the PDF path") {
        runTest {
            var requestedPath: String? = null
            val bytes = byteArrayOf(0x25, 0x50, 0x44, 0x46) // %PDF
            val controller =
                ReleveController(
                    fetch = { DossierResult.Loaded(document()) },
                    exportBytes = { path ->
                        requestedPath = path
                        BytesOutcome.Ok(200, ExportBytes(bytes, "releve-2026-camille-rey.pdf"))
                    },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )

            controller.export(ExportKind.PDF)
            val event = controller.exportEvents.first().shouldBeInstanceOf<ExportEvent.Ready>()

            requestedPath shouldBe "/api/v1/export/pdf?year=2026"
            event.filename shouldBe "releve-2026-camille-rey.pdf"
            event.mimeType shouldBe "application/pdf"
            event.bytes.contentEquals(bytes).shouldBeTrue()
        }
    }

    test("AC2: a CSV export with no server filename falls back to a year-named file (R237 fallback)") {
        runTest {
            val controller =
                ReleveController(
                    fetch = { DossierResult.Loaded(document()) },
                    exportBytes = { BytesOutcome.Ok(200, ExportBytes(byteArrayOf(1, 2, 3), filename = null)) },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )

            controller.export(ExportKind.CSV)
            val event = controller.exportEvents.first().shouldBeInstanceOf<ExportEvent.Ready>()

            event.filename shouldBe "releve-2026.csv"
            event.mimeType shouldBe "text/csv"
        }
    }

    test("SPEC 13.2: a network failure on export is RequiresConnectivity, said plainly") {
        runTest {
            val controller =
                ReleveController(
                    fetch = { DossierResult.Loaded(document()) },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )

            controller.export(ExportKind.PDF)
            controller.exportEvents.first() shouldBe ExportEvent.RequiresConnectivity
        }
    }

    test("a 503 renderer error on export is Failed, not a broken empty file") {
        runTest {
            val controller =
                ReleveController(
                    fetch = { DossierResult.Loaded(document()) },
                    exportBytes = { BytesOutcome.Ok(503, ExportBytes(byteArrayOf(), filename = null)) },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )

            controller.export(ExportKind.PDF)
            controller.exportEvents.first() shouldBe ExportEvent.Failed
        }
    }

    // PARKAN-26: the year switch. The current year is always offered; a past year only when it has days.
    test("PARKAN-26: a past year is offered only when it has days (recordedEntries > 0)") {
        runTest {
            // 2025 has days -> offered, newest first; the current year is selected and provisional.
            val withPrev =
                ReleveController(
                    fetch = { year -> DossierResult.Loaded(document().copy(taxYear = year, recordedEntries = 4)) },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            val loaded = withPrev.state.value.shouldBeInstanceOf<ReleveState.Loaded>()
            loaded.availableYears shouldBe listOf(2026, 2025)
            loaded.selectedYear shouldBe 2026
            loaded.isCurrentYear shouldBe true

            // 2025 returns a valid but EMPTY document (SEED-RELEVE's Camille-2024 shape) -> NOT offered.
            val emptyPrev =
                ReleveController(
                    fetch = { year ->
                        DossierResult.Loaded(
                            document().copy(taxYear = year, recordedEntries = if (year == 2025) 0 else 5),
                        )
                    },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            emptyPrev.state.value.shouldBeInstanceOf<ReleveState.Loaded>().availableYears shouldBe listOf(2026)
        }
    }

    test("PARKAN-26: a past year that read-fails is not offered (SEED-RELEVE Sam-2025 shape)") {
        runTest {
            val controller =
                ReleveController(
                    // 2025 is out of activity -> the route 500s -> Unreadable -> not offered.
                    fetch = { year ->
                        if (year == 2025) DossierResult.Unreadable else DossierResult.Loaded(document())
                    },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            controller.state.value.shouldBeInstanceOf<ReleveState.Loaded>().availableYears shouldBe listOf(2026)
        }
    }

    test("PARKAN-26: selectYear switches the fetched year, recomputes pending, and the export path follows") {
        runTest {
            var requestedPath: String? = null
            val repo =
                repoOf(
                    entry("2026-06-15", SyncState.PENDING),
                    entry("2026-06-16", SyncState.PENDING),
                    entry("2025-06-15", SyncState.PENDING),
                )
            val controller =
                ReleveController(
                    fetch = { year -> DossierResult.Loaded(document().copy(taxYear = year, recordedEntries = 5)) },
                    exportBytes = { path ->
                        requestedPath = path
                        BytesOutcome.Ok(200, ExportBytes(byteArrayOf(1), filename = null))
                    },
                    repository = repo,
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            // On the current year: two 2026 days pending.
            controller.state.value.shouldBeInstanceOf<ReleveState.Loaded>().pendingCount shouldBe 2

            controller.selectYear(2025)
            advanceUntilIdle()
            val loaded = controller.state.value.shouldBeInstanceOf<ReleveState.Loaded>()
            loaded.selectedYear shouldBe 2025
            loaded.document.taxYear shouldBe 2025
            loaded.isCurrentYear shouldBe false
            // The pending count recomputes for 2025 (one pending 2025 day).
            loaded.pendingCount shouldBe 1

            controller.export(ExportKind.PDF)
            controller.exportEvents.first().shouldBeInstanceOf<ExportEvent.Ready>()
            requestedPath shouldBe "/api/v1/export/pdf?year=2025"
        }
    }

    test("PARKAN-26: selectYear ignores a year the selector does not offer (R328 read-only)") {
        runTest {
            val controller =
                ReleveController(
                    fetch = { year -> DossierResult.Loaded(document().copy(taxYear = year, recordedEntries = 5)) },
                    exportBytes = { BytesOutcome.NetworkError },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            controller.selectYear(2020) // never offered
            advanceUntilIdle()
            controller.selectedYear.value shouldBe 2026
            controller.state.value.shouldBeInstanceOf<ReleveState.Loaded>().selectedYear shouldBe 2026
        }
    }
})
