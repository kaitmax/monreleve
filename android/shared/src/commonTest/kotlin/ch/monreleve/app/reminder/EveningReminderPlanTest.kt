package ch.monreleve.app.reminder

import ch.monreleve.app.detection.isWorkingDay
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.toInstant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.days
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-MOVE-REMINDER R1291. WHAT iOS HOLDS AHEAD, FROM VALUES (JVM and the iOS simulator): one request per day of the
// next seven 19:00s that the fallback's decision would remind on - each at 19:00 device-local, today's only while
// 19:00 is still ahead and today is not recorded; none on a weekend or a non-working day; none at all signed out,
// opted out or not permitted. A DST night is asserted by the INSTANTS the requests fire at, not by "19:00" (which the
// wall clock gives by construction). Carried from IOS-2f R892's IosNotificationPlanIosTest (R268): a non-working day,
// opted out, the day already recorded and the day already notified each plan nothing; the reminder is 19:00 local,
// no longer 17:00 Paris (iOS Ruling 3 Q6). 2026-11-16 is a Monday; Paris is UTC+1 in November.

private const val R1291_PARIS = "Europe/Paris"
private val r1291AllIn =
    EveningReminderState(
        signedIn = true,
        optedIn = true,
        notificationsPermitted = true,
        recordedDays = emptySet(),
        notifiedDays = emptySet(),
    )

private fun r1291Day(iso: String): LocalDate = LocalDate.parse(iso)

private fun r1291Days(vararg iso: String): List<String> = iso.toList()

/** A plan, with what its requests fire at as INSTANTS (printed) - what a DST night must move. */
private class R1291Planned(
    val plan: EveningReminderPlan,
    val fires: List<String>,
    val lastWithinSevenDays: Boolean,
)

class EveningReminderPlanTest {
    // The one kotlin.time site of this file: the plan is asked from an instant, and its wall clocks are read back as
    // the instants they fire at in [zone], and whether the last is at most seven days after [now].
    @OptIn(ExperimentalTime::class) // KMP-DT R590 / IOS-MOVE-REMINDER R1291: kotlin.time.Instant - on the allowlist.
    private fun planned(
        now: String,
        zone: String = R1291_PARIS,
        state: EveningReminderState = r1291AllIn,
        workingDay: ((LocalDate) -> Boolean)? = null,
    ): R1291Planned {
        val instant = Instant.parse(now)
        val tz = TimeZone.of(zone)
        val plan =
            if (workingDay == null) {
                eveningReminderPlan(instant, tz, state)
            } else {
                eveningReminderPlan(instant, tz, state, workingDay)
            }
        val fires = plan.reminders.map { it.at.toInstant(tz) }
        val lastWithin = fires.isNotEmpty() && fires.last() - instant <= 7.days
        return R1291Planned(plan, fires.map { it.toString() }, lastWithin)
    }

    private fun plan(
        now: String,
        zone: String = R1291_PARIS,
        state: EveningReminderState = r1291AllIn,
        workingDay: ((LocalDate) -> Boolean)? = null,
    ): EveningReminderPlan = planned(now, zone, state, workingDay).plan

    /** The planned days, ISO. */
    private fun days(plan: EveningReminderPlan): List<String> = plan.reminders.map { it.day.toString() }

    @Test
    fun aMondayBeforeNineteenHoldsTheFiveWorkingDaysOfTheNextSevenEachAtNineteenLocal() {
        val plan = plan("2026-11-16T10:00:00Z")
        assertEquals(r1291Days("2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"), days(plan))
        assertTrue(plan.reminders.all { it.at.time == LocalTime(19, 0) && it.at.date == it.day }, "19:00, that day")
        val fires = planned("2026-11-16T10:00:00Z").fires
        assertEquals(List(5) { "2026-11-${16 + it}T18:00:00Z" }, fires, "19:00 Paris is 18:00Z in November")
    }

    @Test
    fun todayRecordedRemovesTodaysRequestAndOnlyThatOne() {
        val plan = plan("2026-11-16T10:00:00Z", state = r1291AllIn.copy(recordedDays = setOf(r1291Day("2026-11-16"))))
        assertEquals(r1291Days("2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"), days(plan))
        assertTrue(r1291Day("2026-11-16") in plan.unplannedDays, "today's request is removed, not merely not added")
        val later = plan("2026-11-16T10:00:00Z", state = r1291AllIn.copy(recordedDays = setOf(r1291Day("2026-11-18"))))
        assertEquals(r1291Days("2026-11-16", "2026-11-17", "2026-11-19", "2026-11-20"), days(later), "a later day too")
    }

    @Test
    fun todaysRequestIsHeldOnlyWhileNineteenIsStillAhead() {
        assertEquals("2026-11-16", days(plan("2026-11-16T17:59:59.999999999Z")).first(), "a nanosecond before 19:00")
        val at19 = plan("2026-11-16T18:00:00Z")
        assertEquals(r1291Days("2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-23"), days(at19))
        assertTrue(r1291Day("2026-11-16") in at19.unplannedDays, "19:00 has come: today's request is removed")
    }

    @Test
    fun aWeekendGetsNone() {
        val saturday = plan("2026-11-21T10:00:00Z")
        assertEquals(r1291Days("2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"), days(saturday))
        assertTrue(listOf("2026-11-21", "2026-11-22").all { r1291Day(it) in saturday.unplannedDays })
    }

    @Test
    fun aNonWorkingDayGetsNoneTheDefinitionIsTheInputAndItsDefaultIsTheAppsOne() {
        val holiday = r1291Day("2026-11-18")
        val withHoliday = plan("2026-11-16T10:00:00Z") { it != holiday && isWorkingDay(it.dayOfWeek.isoDayNumber) }
        assertEquals(r1291Days("2026-11-16", "2026-11-17", "2026-11-19", "2026-11-20"), days(withHoliday))
        // The default is detection/isWorkingDay, passed explicitly or not: the same plan.
        val explicit = plan("2026-11-21T10:00:00Z") { isWorkingDay(it.dayOfWeek.isoDayNumber) }
        assertEquals(plan("2026-11-21T10:00:00Z"), explicit)
    }

    @Test
    fun aDaylightSavingNightKeepsNineteenLocalTheInstantsMove() {
        // Paris leaves summer time on Sunday 2026-10-25: Friday's 19:00 is 17:00Z, Monday's 18:00Z.
        val autumn = plan("2026-10-23T08:00:00Z")
        val autumnFires = planned("2026-10-23T08:00:00Z").fires
        assertEquals(r1291Days("2026-10-23", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"), days(autumn))
        assertEquals(
            listOf(
                "2026-10-23T17:00:00Z",
                "2026-10-26T18:00:00Z",
                "2026-10-27T18:00:00Z",
                "2026-10-28T18:00:00Z",
                "2026-10-29T18:00:00Z",
            ),
            autumnFires,
        )
        // Zurich enters summer time on Sunday 2026-03-29: Friday's 19:00 is 18:00Z, Monday's 17:00Z.
        val spring = plan("2026-03-27T08:00:00Z", zone = "Europe/Zurich")
        assertEquals(r1291Days("2026-03-27", "2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02"), days(spring))
        assertEquals(
            listOf(
                "2026-03-27T18:00:00Z",
                "2026-03-30T17:00:00Z",
                "2026-03-31T17:00:00Z",
                "2026-04-01T17:00:00Z",
                "2026-04-02T17:00:00Z",
            ),
            planned("2026-03-27T08:00:00Z", zone = "Europe/Zurich").fires,
        )
    }

    @Test
    fun signedOutOptedOutOrNotPermittedPlansNoneAndRemovesTheWholeWindow() {
        val window = (15..23).map { r1291Day("2026-11-$it") }
        listOf(
            "signed out" to r1291AllIn.copy(signedIn = false),
            "opted out" to r1291AllIn.copy(optedIn = false),
            "not permitted" to r1291AllIn.copy(notificationsPermitted = false),
        ).forEach { (why, state) ->
            val plan = plan("2026-11-16T10:00:00Z", state = state)
            assertEquals(emptyList(), plan.reminders, why)
            assertEquals(window, plan.unplannedDays, "$why: every day of the window is removed")
        }
    }

    @Test
    fun aDayAlreadyNotifiedIsNotAskedAgainAfterAZoneChangeBringsNineteenRound() {
        // Delivered at 19:00 Paris (18:00Z); at 18:30Z the phone is in London, where 19:00 is still ahead.
        val london = "Europe/London"
        assertEquals("2026-11-16", days(plan("2026-11-16T18:30:00Z", zone = london)).first(), "the case is real")
        val notified = r1291AllIn.copy(notifiedDays = setOf(r1291Day("2026-11-16")))
        assertEquals("2026-11-17", days(plan("2026-11-16T18:30:00Z", zone = london, state = notified)).first())
    }

    @Test
    fun atMostSevenRequestsAndTheLastAtMostSevenDaysAhead() {
        listOf("2026-11-16T10:00:00Z", "2026-11-16T18:00:00Z").forEach { now ->
            val everyDay = planned(now) { true }
            assertEquals(EVENING_REMINDER_HORIZON, everyDay.plan.reminders.size, "every day a working day, from $now")
            assertTrue(everyDay.lastWithinSevenDays, "the last request is at most 7 days after $now")
        }
    }

    @Test
    fun aZoneChangePlansThatZonesNineteenHundred() {
        val london = plan("2026-11-16T10:00:00Z", zone = "Europe/London")
        assertEquals(days(plan("2026-11-16T10:00:00Z")), days(london))
        val londonFires = planned("2026-11-16T10:00:00Z", zone = "Europe/London").fires
        assertEquals(List(5) { "2026-11-${16 + it}T19:00:00Z" }, londonFires)
    }

    @Test
    fun aFarZoneAsksAboutTheParisDayAsAndroidsWakeDoes() {
        // 19:00 in New York is 01:00 the NEXT day in Paris. Android's wake names today in Paris (todayInParis, R28) and
        // reads its working day and entry from it; the plan does the same: Friday's and Saturday's 19:00 ask about a
        // Paris weekend day (none), and Sunday's 19:00 asks about Monday.
        val ny = plan("2026-11-20T15:00:00Z", zone = "America/New_York")
        assertEquals("2026-11-23", days(ny).first())
        assertEquals(LocalTime(19, 0), ny.reminders.first().at.time)
        assertEquals(r1291Day("2026-11-22"), ny.reminders.first().at.date, "the New York Sunday evening")
    }

    @Test
    fun theWindowIsDisjointFromThePlanAndCoversEveryCandidateDayAndOneEitherSide() {
        listOf("2026-11-16T10:00:00Z", "2026-11-16T18:00:00Z", "2026-11-21T10:00:00Z").forEach { now ->
            val plan = plan(now, state = r1291AllIn.copy(recordedDays = setOf(r1291Day("2026-11-17"))))
            val planned = plan.reminders.map { it.day }
            assertTrue(planned.none { it in plan.unplannedDays }, "disjoint, from $now")
            val all = (planned + plan.unplannedDays).sorted()
            assertEquals(EVENING_REMINDER_HORIZON + 2, all.size, "the candidates' days and one either side, $now")
            assertEquals(all.indices.map { all.first().toEpochDays() + it }, all.map { it.toEpochDays() }, "contiguous")
        }
    }
}
