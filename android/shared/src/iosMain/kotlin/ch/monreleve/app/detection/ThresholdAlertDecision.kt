package ch.monreleve.app.detection

import ch.monreleve.app.settings.AlertThreshold
import ch.monreleve.app.settings.ThresholdCrossing

// AN-ALERT. The threshold alert's DECISION and the same-day MERGE rule, pure and JVM-testable (R291), separate
// from the Android glue that runs the engine and posts (maybeAlertThreshold / EveningNotifier). A LOCAL
// notification that needs no server.
//
// THE WHEN RULES (AN-ALERT section 1), each a branch here:
//   - THE FIRST CROSSING NOTIFIES. An alert fires the first time the forecast would cross a threshold - the
//     transition from not-crossed to crossed - and NOT again while it stays crossed.
//   - A FALL-BACK-THEN-RE-CROSS IS A NEW CROSSING. The last state per threshold is kept on the phone
//     (ThresholdAlertStore); once it falls back under, the next crossing fires again.
//   - OPT-OUT SENDS NOTHING. Off by default; while opted out nothing is evaluated and the state is untouched,
//     so re-opting-in later re-evaluates from the last opted-in state rather than firing on an old crossing.
//   - WHEN BOTH CROSS AT ONCE, the graver (social, 49,9 %) is announced: crossing the social ceiling always
//     implies the fiscal one is crossed too, and losing the Swiss regime is the worse consequence. The fiscal
//     state is still recorded, so it does not alert again later while it stays crossed.
//
// THE SAME-DAY MERGE (section 1): NEVER TWO MON RELEVE NOTIFICATIONS THE SAME DAY. composeDaily maps the two
// possible notices - the evening reminder (AN-NOTIF) and the threshold alert - to the ONE notification to post:
// both -> the evening reminder with the alert's sentence joined and its record buttons kept; one -> that one;
// neither -> nothing.
//
// NOTHING HERE RECORDS A DAY (D16) OR TOUCHES A COORDINATE (D18): the result is a value.

/** The outcome of one alert evaluation: the threshold to announce (or null), and the state to persist. */
data class ThresholdAlertDecision(
    val alert: AlertThreshold?,
    val newState: ThresholdCrossing,
)

/**
 * Decide whether to alert, comparing the [current] crossing against the last-kept [previous] one. Returns the
 * threshold to announce (null when nothing newly crossed) and the state to persist. [current] is null when
 * there is no projection (no rhythm set): nothing to evaluate. While opted out nothing fires and the state is
 * left exactly as it was.
 */
fun decideThresholdAlert(
    optedIn: Boolean,
    current: ThresholdCrossing?,
    previous: ThresholdCrossing,
): ThresholdAlertDecision {
    if (!optedIn || current == null) return ThresholdAlertDecision(null, previous)
    val socialNewlyCrossed = current.social && !previous.social
    val fiscalNewlyCrossed = current.fiscal && !previous.fiscal
    val alert =
        when {
            socialNewlyCrossed -> AlertThreshold.SOCIAL
            fiscalNewlyCrossed -> AlertThreshold.FISCAL
            else -> null
        }
    return ThresholdAlertDecision(alert, current)
}

/** The one Mon Releve notification to post for today, composed from the two possible notices (the merge rule). */
sealed interface DailyNotification {
    /** Nothing to post. */
    data object None : DailyNotification

    /** The threshold alert alone (no evening reminder due): opens the forecast, its own channel. */
    data class Alert(val threshold: AlertThreshold) : DailyNotification

    /** The evening reminder alone (AN-NOTIF): the record buttons, no alert sentence. */
    data class Evening(val notice: EveningNotice) : DailyNotification

    /** Both due the same day: the evening reminder with the alert's sentence joined - record buttons kept. */
    data class Merged(
        val notice: EveningNotice,
        val threshold: AlertThreshold,
    ) : DailyNotification
}

/** Map the evening notice and the active alert to the ONE notification (never two the same day, section 1). */
fun composeDaily(
    evening: EveningNotice?,
    alert: AlertThreshold?,
): DailyNotification =
    when {
        evening != null && alert != null -> DailyNotification.Merged(evening, alert)
        evening != null -> DailyNotification.Evening(evening)
        alert != null -> DailyNotification.Alert(alert)
        else -> DailyNotification.None
    }
