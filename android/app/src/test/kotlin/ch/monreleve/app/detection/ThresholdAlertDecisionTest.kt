package ch.monreleve.app.detection

import ch.monreleve.app.settings.AlertThreshold
import ch.monreleve.app.settings.ThresholdCrossing
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// AN-ALERT. The WHEN rules (section 1) and the same-day MERGE rule (section 1), each a pure branch, proven
// here from values - no Android, no clock. The first crossing notifies; staying crossed does not; a
// fall-back-then-re-cross notifies again; opt-out sends nothing; both thresholds crossing at once announces
// the graver (social); and composeDaily never yields two Mon Releve notifications for one day.
class ThresholdAlertDecisionTest {
    private val none = ThresholdCrossing(fiscal = false, social = false)
    private val fiscalOnly = ThresholdCrossing(fiscal = true, social = false)
    private val both = ThresholdCrossing(fiscal = true, social = true)

    @Test
    fun `the first crossing of the fiscal threshold notifies`() {
        val decision = decideThresholdAlert(optedIn = true, current = fiscalOnly, previous = none)
        assertEquals(AlertThreshold.FISCAL, decision.alert)
        assertEquals(fiscalOnly, decision.newState)
    }

    @Test
    fun `staying crossed does not notify again`() {
        val decision = decideThresholdAlert(optedIn = true, current = fiscalOnly, previous = fiscalOnly)
        assertNull(decision.alert)
        assertEquals(fiscalOnly, decision.newState)
    }

    @Test
    fun `falling back under then re-crossing notifies again`() {
        val back = decideThresholdAlert(optedIn = true, current = none, previous = fiscalOnly)
        assertNull(back.alert)
        assertEquals(none, back.newState)
        val again = decideThresholdAlert(optedIn = true, current = fiscalOnly, previous = back.newState)
        assertEquals(AlertThreshold.FISCAL, again.alert)
    }

    @Test
    fun `crossing the social threshold notifies for social`() {
        val decision = decideThresholdAlert(optedIn = true, current = both, previous = fiscalOnly)
        assertEquals(AlertThreshold.SOCIAL, decision.alert)
    }

    @Test
    fun `both thresholds crossing at once announces the graver social threshold`() {
        val decision = decideThresholdAlert(optedIn = true, current = both, previous = none)
        assertEquals(AlertThreshold.SOCIAL, decision.alert)
        assertEquals(both, decision.newState)
    }

    @Test
    fun `opted out sends nothing and leaves the state untouched`() {
        val decision = decideThresholdAlert(optedIn = false, current = both, previous = fiscalOnly)
        assertNull(decision.alert)
        assertEquals(fiscalOnly, decision.newState)
    }

    @Test
    fun `no rhythm means no projection and no alert`() {
        val decision = decideThresholdAlert(optedIn = true, current = null, previous = none)
        assertNull(decision.alert)
        assertEquals(none, decision.newState)
    }

    @Test
    fun `the same-day merge keeps the evening reminder and joins the alert`() {
        val merged = composeDaily(EveningNotice.Manual, AlertThreshold.FISCAL)
        assertEquals(DailyNotification.Merged(EveningNotice.Manual, AlertThreshold.FISCAL), merged)
    }

    @Test
    fun `the alert alone posts when no evening reminder is due`() {
        assertEquals(DailyNotification.Alert(AlertThreshold.SOCIAL), composeDaily(null, AlertThreshold.SOCIAL))
    }

    @Test
    fun `the evening reminder alone posts when no threshold crossed`() {
        assertEquals(DailyNotification.Evening(EveningNotice.Manual), composeDaily(EveningNotice.Manual, null))
    }

    @Test
    fun `neither due posts nothing`() {
        assertEquals(DailyNotification.None, composeDaily(null, null))
    }
}
