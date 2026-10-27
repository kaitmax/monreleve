package ch.monreleve.app.ui.screens.comparison

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.dossier.AnnexRow
import ch.monreleve.app.dossier.ComparisonView
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.DossierPeriod
import ch.monreleve.app.dossier.DossierTiles
import ch.monreleve.app.dossier.DossierZone
import ch.monreleve.app.dossier.buildComparison
import org.junit.Rule
import org.junit.Test

// AN-RECON: baselines for the comparison screen (design/decide/Employeur.dc.html). A regression guard, not the
// proof of correctness (the device walkthrough is). The view is assembled by the real buildComparison over a
// hand-built dossier, so the figures are the engine's own: the design sample (sample data) - 41,25 % against a
// 39,16 % relevé on a 240 basis = 2,09 points, environ 5,0 jours, with missions (7 logged, all counted, cap 10),
// the simplified method, two unrecorded days, and the several-employers note. Captured tall so the whole screen
// fits one image (R178/R184), at default and 200 percent.

private fun annexRow(
    dayDate: String,
    recorded: Boolean,
): AnnexRow = AnnexRow(dayDate, recorded, null, null, null, null, null, null, null, null, null, false)

private fun document(
    taxYear: Int,
    missionDays: Double,
    credited: Double,
): DossierDocument =
    DossierDocument(
        taxYear = taxYear,
        period = DossierPeriod(1.0, null),
        titulaire = "Camille Berger",
        generatedAt = "2026-01-18",
        canton = "GE",
        employmentRate = 100,
        denominatorKind = "SIMPLIFIED240",
        tiles = DossierTiles(240.0, 75.0, 43.0, missionDays),
        zone = DossierZone(39.16, 39.16, false, 96.0, 17.0, 40.5, emptyList()),
        months = emptyList(),
        annex =
            listOf(
                annexRow("2025-03-03", true),
                annexRow("2025-03-04", true),
                annexRow("2025-03-05", false),
                annexRow("2025-03-06", false),
            ),
        absenceDays = 3.0,
        recordedEntries = 50,
        creditedMissionDays = credited,
        rateWithoutMissions = 39.16,
    )

private val WITH_GAP: ComparisonView =
    buildComparison(
        document = document(taxYear = 2025, missionDays = 7.0, credited = 7.0),
        isCurrentYear = false,
        daysUnsynced = 0,
        missionCap = 10,
        simplifiedBasisDays = 240,
        employerRate = 41.25,
    )

private val REFUSED: ComparisonView =
    buildComparison(
        document = document(taxYear = 2026, missionDays = 0.0, credited = 0.0),
        isCurrentYear = true,
        daysUnsynced = 0,
        missionCap = 10,
        simplifiedBasisDays = 240,
        employerRate = null,
    )

private const val TALL = 3200
private const val TALLER = 6400

class ComparisonScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = TALL),
            theme = "android:Theme.Material.Light.NoActionBar",
            // IOS-1b-A R626 (R345): zero, stated - never Paparazzi 1.3.5's default 0.1. Guarded by
            // fences/PaparazziZeroToleranceTest, which reads the VALUE off this rule.
            maxPercentDifference = 0.0,
        )

    @Composable
    private fun host(
        view: ComparisonView,
        input: String,
        rate: Double?,
    ) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                ComparisonScreen(view = view, employerInput = input, employerRate = rate, actions = ComparisonActions())
            }
        }
    }

    @Test
    fun comparisonWithGap() {
        paparazzi.snapshot { host(WITH_GAP, "41,25 %", 41.25) }
    }

    @Test
    fun comparisonWithGapLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(screenHeight = TALLER, fontScale = 2f))
        paparazzi.snapshot { host(WITH_GAP, "41,25 %", 41.25) }
    }

    @Test
    fun comparisonRefused() {
        paparazzi.snapshot { host(REFUSED, "", null) }
    }
}
