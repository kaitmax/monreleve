package ch.monreleve.app.ios

import ch.monreleve.app.reminder.EveningReminderState
import ch.monreleve.app.reminder.eveningReminderPlan
import kotlinx.datetime.TimeZone
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

// IOS-MOVE-REMINDER R1292. THE HOST PROBE'S ONE CALL INTO THE EVENING REMINDER (ios/MonReleve/Sources/HostProbe.swift,
// step (5), run only on a `-probe YES` launch of the ad-hoc simulator app - never by the product). The glue's request
// set can only be HELD by a notification centre inside an app bundle (the test binary has none), so this lets the probe
// measure, on the simulator's real UNUserNotificationCenter, what the production glue leaves pending: the plan from the
// device's clock and zone, for a person signed in and opted in with nothing recorded (or signed out), handed to
// replanEveningReminders over the SYSTEM centre. It returns the identifiers it planned, for the probe to compare with
// what the centre then lists. KeychainRoundTripResult.kt's shape: probe-only Kotlin that never throws into Swift.

/** Re-plans the evening reminders on the device's centre and returns the identifiers planned. Probe only. */
@OptIn(ExperimentalTime::class) // KMP-DT R590 / IOS-MOVE-REMINDER R1292: kotlin.time.Clock - on the allowlist.
fun eveningReminderProbeReplan(signedIn: Boolean): List<String> {
    val state =
        EveningReminderState(
            signedIn = signedIn,
            optedIn = true,
            notificationsPermitted = true,
            recordedDays = emptySet(),
            notifiedDays = emptySet(),
        )
    val plan = eveningReminderPlan(Clock.System.now(), TimeZone.currentSystemDefault(), state)
    replanEveningReminders(plan, SystemEveningReminderCenter())
    return plan.reminders.map { eveningReminderIdentifier(it.day) }
}
