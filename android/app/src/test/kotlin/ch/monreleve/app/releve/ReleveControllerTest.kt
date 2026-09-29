package ch.monreleve.app.releve

import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.DossierPeriod
import ch.monreleve.app.dossier.DossierTiles
import ch.monreleve.app.dossier.DossierZone
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest

// AN11 increment 1. The controller carries the SERVER's document to the screen and recomputes nothing
// (FW12): a Loaded fetch becomes ReleveState.Loaded holding the SAME document instance, with the two
// ceilings read from the year's RuleSet (the only figures the zone payload does not carry). Each failure
// maps to the state that shows the right sentence (R210 distinguishes an expiry from a replay).

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

@OptIn(ExperimentalCoroutinesApi::class)
class ReleveControllerTest : FunSpec({
    test("a loaded fetch carries the server's document verbatim, with the year's ceilings (R181)") {
        runTest {
            val doc = document()
            val controller = ReleveController(fetch = { DossierResult.Loaded(doc) }, taxYear = TAX_YEAR, scope = this)
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

    test("a network failure is Failed(NETWORK), offering a retry rather than a blank screen") {
        runTest {
            val controller =
                ReleveController(fetch = { DossierResult.NetworkError }, taxYear = TAX_YEAR, scope = this)
            advanceUntilIdle()
            controller.state.value shouldBe ReleveState.Failed(ReleveError.NETWORK)
        }
    }

    test("an unreadable response is Failed(SERVER)") {
        runTest {
            val controller =
                ReleveController(fetch = { DossierResult.Unreadable }, taxYear = TAX_YEAR, scope = this)
            advanceUntilIdle()
            controller.state.value shouldBe ReleveState.Failed(ReleveError.SERVER)
        }
    }

    test("an expiry and a replay map to different states, so their copy can differ (R210)") {
        runTest {
            val expired =
                ReleveController(fetch = { DossierResult.SessionExpired }, taxYear = TAX_YEAR, scope = this)
            advanceUntilIdle()
            expired.state.value shouldBe ReleveState.Failed(ReleveError.SESSION_EXPIRED)

            val ended =
                ReleveController(fetch = { DossierResult.SessionEnded }, taxYear = TAX_YEAR, scope = this)
            advanceUntilIdle()
            ended.state.value shouldBe ReleveState.Failed(ReleveError.SESSION_ENDED)
        }
    }
})
