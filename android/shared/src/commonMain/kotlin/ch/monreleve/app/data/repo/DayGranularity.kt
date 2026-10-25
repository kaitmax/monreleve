package ch.monreleve.app.data.repo

import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.settings.Settings

// AN-GRANULARITY (R490, R492, R494). A DAY KEEPS THE GRANULARITY IT WAS RECORDED IN.
//
// THE RULE, as the operator ruled it (R490): the day/half-day setting decides how NEW days are asked for. A day that
// already has rows is shown and edited in the granularity those rows have - a day held whole stays one whole-day
// answer in half-day mode, a day held in halves keeps its two halves in whole-day mode.
//
// IT LIVES IN THE RECORD PATH (R492), beside the repository that refuses to break it. The screens read the same
// functions to decide what to offer, so a screen built from this file never reaches the refusal; the refusal is the
// guard for a writer that does not know the rule - a future screen, a notification, iOS.
//
// WHAT IT DOES NOT DO. It never retires a row: replacing FULL by two halves (option B) needs an event that does not
// exist, a deliberate schema and wire decision (PARK-W1). It never changes how a day counts: "halves outrank FULL"
// (option C) is REJECTED - both engines and the Releve stay exactly as they were.

/** How a day is asked for and edited: one whole-day answer, or a morning and an afternoon. */
enum class DayGranularity { WHOLE_DAY, HALF_DAYS }

/**
 * The setting's granularity - the ONE home for reading it as a [DayGranularity] (R206). The settings carry the wire's
 * string ("DAY" or "HALF_DAY"); anything that is not HALF_DAY asks for whole days, as every screen always has.
 */
fun dayGranularityOf(settings: Settings?): DayGranularity =
    if (settings?.granularity == "HALF_DAY") DayGranularity.HALF_DAYS else DayGranularity.WHOLE_DAY

/** What one day's rows already say. MIXED holds a whole-day row beside a half (R494): shown, never repaired. */
enum class HeldGranularity { NONE, WHOLE_DAY, HALF_DAYS, MIXED }

/** The granularity [held] - the portions one account holds for one day - already has. */
fun heldGranularity(held: Collection<Portion>): HeldGranularity {
    val whole = Portion.FULL in held
    val halves = Portion.AM in held || Portion.PM in held
    return when {
        whole && halves -> HeldGranularity.MIXED
        whole -> HeldGranularity.WHOLE_DAY
        halves -> HeldGranularity.HALF_DAYS
        else -> HeldGranularity.NONE
    }
}

private val WHOLE_DAY_PORTIONS = listOf(Portion.FULL)
private val HALF_DAY_PORTIONS = listOf(Portion.AM, Portion.PM)

private fun DayGranularity.portions(): List<Portion> =
    when (this) {
        DayGranularity.WHOLE_DAY -> WHOLE_DAY_PORTIONS
        DayGranularity.HALF_DAYS -> HALF_DAY_PORTIONS
    }

/**
 * R490 / R494: the portions a screen offers for one day, in order. A day with rows is offered in THEIR granularity -
 * FULL for a day held whole, AM and PM for a day held in halves - and a day with none in the [setting]'s. A day already
 * MIXED is offered exactly the rows it holds: each of them can be edited, none can be added.
 */
fun portionsToOffer(
    held: Collection<Portion>,
    setting: DayGranularity,
): List<Portion> =
    when (heldGranularity(held)) {
        HeldGranularity.NONE -> setting.portions()
        HeldGranularity.WHOLE_DAY -> WHOLE_DAY_PORTIONS
        HeldGranularity.HALF_DAYS -> HALF_DAY_PORTIONS
        // Portion's declaration order (FULL, AM, PM) is the order a day reads in, so the screens list it that way.
        HeldGranularity.MIXED -> held.distinct().sorted()
    }

/**
 * R493: the granularity the day was recorded in, when it is NOT the [setting]'s - the condition for the one-sentence
 * notice that tells the person why the screen offers something other than their setting. Null when they agree, when
 * the day is empty (it is asked for in the setting's) and when it is mixed (R494: shown as its rows say, no notice).
 */
fun recordedInOtherGranularity(
    held: Collection<Portion>,
    setting: DayGranularity,
): DayGranularity? {
    val recorded =
        when (heldGranularity(held)) {
            HeldGranularity.WHOLE_DAY -> DayGranularity.WHOLE_DAY
            HeldGranularity.HALF_DAYS -> DayGranularity.HALF_DAYS
            HeldGranularity.NONE, HeldGranularity.MIXED -> null
        }
    return recorded?.takeIf { it != setting }
}

/**
 * R492: would writing [portion] put a whole-day row beside a half, or a half beside a whole-day row, for a day that
 * holds [held]? An EDIT of a row that already exists never does - which is what lets a day already mixed have its
 * existing rows' kinds edited (R494) while nothing is ever added to it.
 */
fun wouldMixGranularity(
    portion: Portion,
    held: Collection<Portion>,
): Boolean =
    portion !in held &&
        when (portion) {
            Portion.FULL -> Portion.AM in held || Portion.PM in held
            Portion.AM, Portion.PM -> Portion.FULL in held
        }
