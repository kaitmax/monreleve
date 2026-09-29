package ch.monreleve.app.ui.screens.releve

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.dossier.AnnexRow
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.DossierMonth
import ch.monreleve.app.dossier.DossierPeriod
import ch.monreleve.app.dossier.DossierTiles
import ch.monreleve.app.dossier.DossierWarning
import ch.monreleve.app.dossier.DossierZone
import ch.monreleve.app.releve.ReleveError
import ch.monreleve.app.releve.ReleveRules
import ch.monreleve.app.releve.ReleveState
import org.junit.Rule
import org.junit.Test

// AN11 increment 1: baselines for the Releve screen (SPEC 11.4, SPEC 12, FD7). A regression guard, not the
// proof of correctness (the device walkthrough is, increment 5, R176/R177). The annex is COLLAPSED here,
// as SPEC 12 says it is on screen; it is driven open on the device. Captured on a TALL device so the whole
// document fits one image (R184: the point is to look at it), at default and 200 percent (fontScale 2f).
//
// The figures are a hand-built display fixture: the screen recomputes nothing, so a coherent DossierDocument
// is all it needs. 2026's RuleSet ceilings (0,4 / 0,499) are supplied as ReleveRules, as the controller does.

private val RULES_2026 = ReleveRules(fiscalCeiling = 0.4, socialCeiling = 0.499, simplifiedBasisDays = 240)

@Suppress("LongParameterList") // a display fixture builder; the columns are the point
private fun month(
    m: Int,
    swiss: Double,
    telework: Double,
    france: Double = 0.0,
    third: Double = 0.0,
    cumul: Double,
): DossierMonth =
    DossierMonth(m, swiss, telework, france, third, absenceDays = 0.0, cumulativeDeclarableRate = cumul)

private val MONTHS =
    listOf(
        month(1, 13.0, 8.0, cumul = 3.33),
        month(2, 12.0, 8.0, cumul = 6.66),
        month(3, 15.0, 8.0, cumul = 10.00),
        month(4, 13.0, 7.0, cumul = 12.91),
        month(5, 14.0, 8.0, cumul = 16.25),
        month(6, 8.0, 4.0, france = 1.0, third = 0.0, cumul = 18.33),
    ) + (7..12).map { month(it, 0.0, 0.0, cumul = 18.33) }

private val ANNEX =
    listOf(
        recorded("2026-06-18", "HOME", first = "2026-06-18T18:03:00.000Z"),
        recorded("2026-06-17", "HOME", first = "2026-06-17T19:12:00.000Z"),
        AnnexRow("2026-06-16", false, null, null, null, null, null, null, null, null, null, false),
        recorded("2026-06-15", "CH", first = "2026-06-15T18:40:00.000Z"),
        recorded("2026-06-09", "MISSION_FR", note = "Deplacement client Lyon", first = "2026-06-09T20:22:00.000Z"),
        AnnexRow(
            "2026-06-03", true, "FULL", "HOME", null, "Reunion annulee", "MANUAL", null,
            "2026-06-15T21:08:00.000Z", null, null, late = true,
        ),
    )

private fun recorded(
    day: String,
    kind: String,
    note: String? = null,
    first: String,
): AnnexRow =
    AnnexRow(
        dayDate = day,
        recorded = true,
        portion = "FULL",
        kind = kind,
        absenceReason = null,
        note = note,
        provenance = "MANUAL",
        detectedKind = null,
        firstRecordedAt = first,
        lastModifiedAt = null,
        clientClaimedAt = null,
        late = false,
    )

@Suppress("LongParameterList") // a display fixture builder for several zone states
private fun document(
    declarable: Double,
    raw: Double,
    remainingFiscal: Double,
    remainingSocial: Double,
    recordedEntries: Int = ANNEX.count { it.recorded },
    warnings: List<DossierWarning> = emptyList(),
): DossierDocument =
    DossierDocument(
        taxYear = 2026,
        period = DossierPeriod(fraction = 1.0, startDate = null),
        titulaire = "Camille Berger",
        generatedAt = "2026-06-18T18:04:00.000Z",
        canton = "GE",
        employmentRate = 100,
        denominatorKind = "SIMPLIFIED240",
        tiles = DossierTiles(workedDays = 240.0, swissDays = 75.0, teleworkDays = 43.0, missionDays = 1.0),
        zone =
            DossierZone(
                declarableRate = declarable,
                rawRate = raw,
                ratesDiffer = declarable != raw,
                fiscalCeilingDays = 96.0,
                remainingToFiscal = remainingFiscal,
                remainingToSocial = remainingSocial,
                warnings = warnings,
            ),
        months = MONTHS,
        annex = ANNEX,
        absenceDays = 3.0,
        recordedEntries = recordedEntries,
    )

private fun loaded(
    document: DossierDocument,
    pendingCount: Int = 0,
    offline: Boolean = false,
): ReleveState.Loaded = ReleveState.Loaded(document, RULES_2026, pendingCount, offline)

private val COMPLIANT =
    loaded(
        document(
            declarable = 18.33,
            raw = 19.50,
            remainingFiscal = 52.0,
            remainingSocial = 76.5,
            warnings = listOf(DossierWarning.ExactMethodUnverified),
        ),
    )

// R287: three days pending on the device. The releve names them as absent from the server's document - the
// count-0 baselines above show the line is absent otherwise (R119 by count, across the baseline pair).
private val WITH_PENDING =
    loaded(
        document(declarable = 18.33, raw = 19.50, remainingFiscal = 52.0, remainingSocial = 76.5),
        pendingCount = 3,
    )

private val OVER_CEILING =
    loaded(
        document(
            declarable = 44.20,
            raw = 45.10,
            remainingFiscal = -10.0,
            remainingSocial = 13.0,
        ),
    )

private val EMPTY_YEAR =
    loaded(
        document(
            declarable = 0.0,
            raw = 0.0,
            remainingFiscal = 96.0,
            remainingSocial = 119.8,
            recordedEntries = 0,
        ),
    )

private const val TALL = 6000

// The document roughly doubles in height at 200 percent text, so the tall config is taller still, to
// photograph the WHOLE document rather than cutting it off at the monthly table (a below-the-fold blind
// spot is a decision about where to look, R178).
private const val TALLER = 14000

class ReleveScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = TALL),
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    @Composable
    private fun host(state: ReleveState) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                ReleveScreen(state = state, actions = ReleveActions(onRetry = {}))
            }
        }
    }

    @Test
    fun releveDefault() {
        paparazzi.snapshot { host(COMPLIANT) }
    }

    @Test
    fun releveLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(screenHeight = TALLER, fontScale = 2f))
        paparazzi.snapshot { host(COMPLIANT) }
    }

    @Test
    fun releveOverCeiling() {
        paparazzi.snapshot { host(OVER_CEILING) }
    }

    @Test
    fun releveWithPending() {
        paparazzi.snapshot { host(WITH_PENDING) }
    }

    @Test
    fun releveEmptyRecord() {
        paparazzi.snapshot { host(EMPTY_YEAR) }
    }

    @Test
    fun releveFailed() {
        paparazzi.snapshot { host(ReleveState.Failed(ReleveError.NETWORK)) }
    }
}
