package ch.monreleve.app.forecast

import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.settings.Settings
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

// AN-ALERT (R340, R281). The forecast's threshold crossing comes from the EXISTING engine, never UI
// arithmetic. crossingOf is inclusive on the compliant side (R32, exactly as zoneFor); projectedThresholdCrossing
// runs the shared aggregation + engine on the imagined year and reads its declarable rate against the RuleSet
// ceilings. Computing it writes nothing (R340): it takes values (the recorded days, the rhythm, today) and
// returns a value - there is no store, no DAO, no network in its path. The rhythms chosen stay inside the
// engine's valid range (teleworkDays <= the simplified total of 240), so they exercise a real forecast rather
// than a rejected one.
class ThresholdForecastTest {
    private val settings =
        Settings(
            canton = "GE",
            employmentRate = 100,
            denominatorKind = "SIMPLIFIED240",
            exactTotalWorkDays = null,
            granularity = "DAY",
            activityStartDate = null,
        )
    private val today = LocalDate.of(2026, 1, 1)
    private val taxYear = 2026

    @Test
    fun `an all-suisse rhythm crosses neither threshold`() {
        val rhythm =
            WeeklyRhythm(
                monday = RhythmKind.SUISSE,
                tuesday = RhythmKind.SUISSE,
                wednesday = RhythmKind.SUISSE,
                thursday = RhythmKind.SUISSE,
                friday = RhythmKind.SUISSE,
            )
        val crossing = projectedThresholdCrossing(settings, emptyList(), rhythm, today, taxYear)
        assertFalse("an all-suisse year crosses no fiscal ceiling", crossing?.fiscal ?: true)
        assertFalse("an all-suisse year crosses no social ceiling", crossing?.social ?: true)
    }

    @Test
    fun `a three-day-a-week domicile rhythm crosses both thresholds`() {
        // Monday, Wednesday, Friday at home over the whole year is about 156/240 = 65 %: past both ceilings,
        // and teleworkDays (~156) stays under the 240-day total so the engine accepts the year.
        val rhythm =
            WeeklyRhythm(
                monday = RhythmKind.DOMICILE,
                tuesday = RhythmKind.SUISSE,
                wednesday = RhythmKind.DOMICILE,
                thursday = RhythmKind.SUISSE,
                friday = RhythmKind.DOMICILE,
            )
        val crossing = projectedThresholdCrossing(settings, emptyList(), rhythm, today, taxYear)
        assertTrue("a three-day-a-week home year crosses the fiscal ceiling", crossing?.fiscal == true)
        assertTrue("a three-day-a-week home year crosses the social ceiling", crossing?.social == true)
    }

    @Test
    fun `no rhythm yields no crossing`() {
        assertNull(projectedThresholdCrossing(settings, emptyList(), WeeklyRhythm(), today, taxYear))
    }

    @Test
    fun `crossingOf is inclusive on the compliant side (R32)`() {
        assertFalse("exactly 40 is not past the fiscal ceiling", crossingOf(40.0, 0.40, 0.499).fiscal)
        assertTrue("just above 40 crosses the fiscal ceiling", crossingOf(40.01, 0.40, 0.499).fiscal)
        assertFalse("40,5 is past fiscal but not social", crossingOf(40.5, 0.40, 0.499).social)
        assertFalse("exactly 49,9 is not past the social ceiling", crossingOf(49.9, 0.40, 0.499).social)
        assertTrue("just above 49,9 crosses the social ceiling", crossingOf(49.91, 0.40, 0.499).social)
    }
}
