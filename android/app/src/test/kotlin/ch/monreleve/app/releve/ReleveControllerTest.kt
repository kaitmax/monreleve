package ch.monreleve.app.releve

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.DossierPeriod
import ch.monreleve.app.dossier.DossierTiles
import ch.monreleve.app.dossier.DossierZone
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
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
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            expired.state.value shouldBe ReleveState.Failed(ReleveError.SESSION_EXPIRED)

            val ended =
                ReleveController(
                    fetch = { DossierResult.SessionEnded },
                    repository = repoOf(),
                    taxYear = TAX_YEAR,
                    scope = this,
                )
            advanceUntilIdle()
            ended.state.value shouldBe ReleveState.Failed(ReleveError.SESSION_ENDED)
        }
    }
})
