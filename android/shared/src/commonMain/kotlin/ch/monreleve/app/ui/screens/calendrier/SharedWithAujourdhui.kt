package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import ch.monreleve.app.calendar.CalendarDayUi
import ch.monreleve.app.design.DayProvenance
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.DayCellCopy
import ch.monreleve.app.fr.LegendCopy
import ch.monreleve.app.onboarding.GranularityChoice

// IOS-1b-A R604. THE THREE PIECES OF THE CALENDAR'S UI THAT AUJOURD'HUI ALREADY SHARED (R206/R328: one home each).
//
// The calendar screen does not move (the prompt's boundary); these three did not belong to it alone - Aujourd'hui
// reads the same list threshold, the same day-in-words and the same granularity sentence - so they move out of
// CalendrierScreen.kt, CalendarList.kt and CalendarEditSheet.kt, unchanged, into :shared commonMain where both the
// shared Aujourd'hui screen and the calendar in :app reach them. Package unchanged; internal -> public, because the
// calendar now reads them across the module boundary.

// R271, AC3: the font scale at and above which the seven-column grid stops being legible and the screen
// becomes a list. MEASURED on the device, not chosen: at 1.5x the two-digit day number and the letter
// already crowd a ~45 dp column, and at 2.0x they overlap; 1.3x still reads. The figure and how it was
// measured are recorded in REPORT-AN10.txt. A behavioural constant, not a design token (not a radius,
// colour or spacing value), so it lives here rather than in Tokens.kt.
// AN-HOME (R328/R206): the home's « Cette semaine » strip follows the SAME rule, so it reads this one home
// (the relay: "it follows the calendar's rule and becomes a list") rather than a second 1.5f.
const val LIST_FONT_SCALE_THRESHOLD = 1.5f

/**
 * AN-GRANULARITY (R490, R493): why this day is offered in another granularity than the setting's - one sentence, only
 * when the day was recorded otherwise (a day held whole in half-day mode, or held in halves in whole-day mode). The
 * setting decides how new days are asked for; it never re-cuts a recorded one. Aujourd'hui shows the same sentence.
 */
@Composable
fun RecordedGranularityNotice(recordedAs: GranularityChoice?) {
    val text =
        when (recordedAs) {
            GranularityChoice.DAY -> AujourdhuiCopy.RECORDED_WHOLE_DAY
            GranularityChoice.HALF_DAY -> AujourdhuiCopy.RECORDED_HALF_DAYS
            null -> return
        }
    Text(
        text = text,
        style = FrontierType.body,
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.md))
                .background(LightColors.infoBg)
                .padding(Spacing.space12),
    )
}

/**
 * One day in words, as a list row prints them after its date: the kind (BOTH kinds of a split half-day, R292), the
 * quality, and who recorded it. ONE HOME (R206) for the calendar's large-text list and Aujourd'hui's week list, which
 * each render these words one Text apiece - so the words are asserted where both rows take them from (R225).
 */
fun dayWords(day: CalendarDayUi): List<String> {
    val kindWord = day.kind?.let { LegendCopy.forKind(it.letter) }
    val secondKindWord = day.secondKind?.let { LegendCopy.forKind(it.letter) }
    val qualityWord = CalendarCopy.qualityWord(day.quality.name)
    return listOfNotNull(kindWord, secondKindWord, qualityWord) + provenanceWords(day.provenance, day.secondProvenance)
}

/**
 * AN-GRANULARITY (R519): who recorded the day, as its rows say - from the one home (DayCellCopy.provenanceLabel),
 * never a constant. The manual product named only « Saisie manuelle » and said NOTHING of a detected day; since
 * AN-PULL brings detected days down, that silence misstated them. Halves recorded differently each state their own.
 */
private fun provenanceWords(
    morning: DayProvenance?,
    afternoon: DayProvenance?,
): List<String> {
    val first = morning?.let { DayCellCopy.provenanceLabel(it.name) }
    val second = afternoon?.let { DayCellCopy.provenanceLabel(it.name) }
    return when {
        first == null -> emptyList()
        second == null -> listOf(first)
        else ->
            listOf(
                AujourdhuiCopy.halfLabel(AujourdhuiCopy.MORNING, first),
                AujourdhuiCopy.halfLabel(AujourdhuiCopy.AFTERNOON, second),
            )
    }
}
