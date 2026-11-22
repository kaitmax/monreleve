package ch.monreleve.app.ios

import ch.monreleve.app.fr.NotificationCopy
import ch.monreleve.app.fr.text.formatDayLong
import ch.monreleve.app.reminder.EveningReminderPlan
import ch.monreleve.app.reminder.EveningReminderState
import ch.monreleve.app.reminder.eveningReminderPlan
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import platform.UserNotifications.UNCalendarNotificationTrigger
import platform.UserNotifications.UNNotificationRequest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-MOVE-REMINDER R1291/R1292. THE iOS GLUE'S REQUEST SET, BUILT ON THE SIMULATOR: replanEveningReminders turns the
// common plan into real UNNotificationRequest objects (content, calendar trigger, identifier) and hands them to the
// centre, beside the identifiers it removes. The CENTRE is a recording one: the real UNUserNotificationCenter raises
// an Objective-C exception in this bundle-less test process (AppHostProbeIosTest's header; IosLocalStoreIosTest), so
// what the system then holds is measured where a bundle exists - I2's walkthrough (the observable is in
// REPORT-IOS-MOVE-REMINDER.txt, R1292). Carried from IOS-2f R892 (R268): what the request says is the MANUAL question
// (iOS v1 is manual-only), and nothing is held for a day any rule refuses. 2026-11-16 is a Monday.

private val r1292AllIn =
    EveningReminderState(
        signedIn = true,
        optedIn = true,
        notificationsPermitted = true,
        recordedDays = emptySet(),
        notifiedDays = emptySet(),
    )

private class R1292RecordingCentre : EveningReminderCenter {
    val removed = mutableListOf<String>()
    val added = mutableListOf<UNNotificationRequest>()

    override fun removePending(identifiers: List<String>) {
        removed += identifiers
    }

    override fun add(request: UNNotificationRequest) {
        added += request
    }
}

private fun r1292Id(iso: String): String = EVENING_REMINDER_ID_PREFIX + iso

class IosEveningRemindersIosTest {
    /** The common plan from Monday 2026-11-16 10:00Z in Paris (the five working days, each at 19:00). */
    @OptIn(ExperimentalTime::class) // KMP-DT R590 / IOS-MOVE-REMINDER R1292: kotlin.time.Instant - on the allowlist.
    private fun mondayPlan(state: EveningReminderState = r1292AllIn): EveningReminderPlan =
        eveningReminderPlan(Instant.parse("2026-11-16T10:00:00Z"), TimeZone.of("Europe/Paris"), state)

    private fun replanned(plan: EveningReminderPlan): R1292RecordingCentre =
        R1292RecordingCentre().also { replanEveningReminders(plan, it) }

    @Test
    fun oneRequestPerPlannedDayAtItsNineteenLocalWallClockNeverRepeating() {
        val centre = replanned(mondayPlan())
        val days = listOf("2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20")
        assertEquals(days.map(::r1292Id), centre.added.map { it.identifier })
        centre.added.zip(days).forEach { (request, iso) ->
            val trigger = assertNotNull(request.trigger as? UNCalendarNotificationTrigger, "a calendar trigger, $iso")
            val at = trigger.dateComponents
            val day = LocalDate.parse(iso)
            assertEquals(
                listOf(day.year.toLong(), day.month.ordinal.toLong() + 1, day.day.toLong(), 19L, 0L),
                listOf(at.year, at.month, at.day, at.hour, at.minute),
                "year, month, day, 19, 00 - $iso",
            )
            assertNull(at.timeZone, "no zone: 19:00 in the device's zone of that evening, $iso")
            assertFalse(trigger.repeats, "once, $iso")
        }
    }

    @Test
    fun theRequestSaysWhatAndroidsManualReminderSays() {
        val request = replanned(mondayPlan()).added.first()
        assertEquals(NotificationCopy.MANUAL_TITLE, request.content.title)
        assertEquals(formatDayLong("2026-11-16"), request.content.body)
        assertTrue(request.content.body.contains("16"), "positive control: the body names the day")
    }

    @Test
    fun itRemovesTheUnplannedDaysOfTheWindowAndNeverAPlannedOne() {
        val recorded = mondayPlan(r1292AllIn.copy(recordedDays = setOf(LocalDate.parse("2026-11-16"))))
        val centre = replanned(recorded)
        assertTrue(r1292Id("2026-11-16") in centre.removed, "today recorded: today's request removed")
        assertFalse(r1292Id("2026-11-16") in centre.added.map { it.identifier }, "and not added back")
        assertEquals(recorded.unplannedDays.map { r1292Id(it.toString()) }, centre.removed)
        assertTrue(centre.added.none { it.identifier in centre.removed }, "the two sets are disjoint")
    }

    @Test
    fun signedOutOrOptedOutAddsNothingAndRemovesTheWholeWindow() {
        listOf(r1292AllIn.copy(signedIn = false), r1292AllIn.copy(optedIn = false)).forEach { state ->
            val centre = replanned(mondayPlan(state))
            assertEquals(0, centre.added.size)
            assertEquals((15..23).map { r1292Id("2026-11-$it") }, centre.removed)
        }
    }

    @Test
    fun theDeliveredListNamesTheDaysAlreadyRemindedAndNothingElse() {
        val foreign = "ch.monreleve.app.probe.notification"
        val delivered = listOf(r1292Id("2026-11-16"), foreign, r1292Id("not-a-day"), r1292Id("2026-11-17"))
        assertEquals(
            setOf(LocalDate.parse("2026-11-16"), LocalDate.parse("2026-11-17")),
            deliveredEveningReminderDays(delivered),
        )
        assertNull(eveningReminderDayOf(foreign), "another request is not ours")
        val day = LocalDate.parse("2026-11-20")
        assertEquals(day, eveningReminderDayOf(eveningReminderIdentifier(day)), "the identifier round-trips")
    }
}
