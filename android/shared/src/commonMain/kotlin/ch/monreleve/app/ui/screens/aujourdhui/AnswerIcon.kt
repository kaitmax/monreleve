package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Glyph
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.glyphPainter
import ch.monreleve.app.design.glyphSemanticsId
import ch.monreleve.app.design.kindIconRes
import ch.monreleve.app.design.statusIconRes
import ch.monreleve.app.fr.AujourdhuiCopy

// IOS-1b-A R604: MOVED FROM :app to :shared commonMain (package unchanged) - Aujourd'hui is one shared screen,
// hosted by Android's activity and by the iOS pilot.

// AN-ANSWER-ICON (R430). The answer the choice card closes into carries an icon for WHAT WAS ANSWERED, so a
// glance tells the person the day is recorded AND what it was recorded as. Lucide glyphs, committed as vector
// drawables beside the eight AN10b already ships (docs/lucide-icons.md, AnswerIconDrawablesTest), drawn at the
// `icon` size token (20 dp).
//
// NOT A PLACE, A KIND. DESIGN-SYSTEM section 2 removes the map, the pin, the live dot and the flag from this
// product, and R430 names the same three. So « En Suisse » is a building, not a country; « Domicile » is a
// house, not a home pin; a mission is a briefcase or an aeroplane, not a route; and an absence is a struck-out
// calendar, which is a day rather than a location at all.
//
// THE GLYPH IS DECORATIVE (R430). contentDescription is null because the words sit beside it and say the same
// thing - TalkBack must read the day once, not twice. The words are never absent: an AnswerLine carries both.
// The drawable id is written into the semantics for tests only (design/KindIconSemantics.kt, R433); a custom
// SemanticsPropertyKey is not read by any accessibility service.
//
// IT IS NOT THE STATUS ICON AND CANNOT BE MISTAKEN FOR ONE (R432). The sync truth is its own line BELOW this
// one, in its own words - « Enregistré sur le téléphone, en attente d'envoi » / « Enregistré » - and in the
// error colour when the server refused. Different position, different row, and the status has never had a
// glyph of its own to confuse this with (see the report's R432 note).

// IOS-1b-A R604: a Glyph (design/Glyph.kt) - the same drawable file on Android and iOS; on Android the semantics
// still carry the app's R.drawable id, so the instrumented tests' literal assertions hold unedited.

/** The Lucide glyph for a recorded kind. The ONE mapping; the tests assert the drawables, never this. */
internal fun kindIcon(kind: RecordedKind): Glyph =
    when (kind) {
        RecordedKind.SUISSE -> Glyph.BUILDING_2
        RecordedKind.DOMICILE -> Glyph.HOUSE
        RecordedKind.MISSION_FRANCE -> Glyph.BRIEFCASE
        RecordedKind.MISSION_THIRD -> Glyph.PLANE
        RecordedKind.ABSENCE -> Glyph.CALENDAR_X
    }

/**
 * AN-POLISH (R436), closing PARK-I5. THE ANSWER LINE'S GLYPHS GROW WITH THE TEXT.
 *
 * At the system's largest font scale the words double and a fixed 20 dp glyph reads as a speck beside them -
 * visible in aujourdhuiHalfDayCompleteLarge, which is where PARK-I5 was found. The glyph now takes the `icon`
 * SIZE TOKEN TIMES THE FONT SCALE, which is exactly the multiplier the text beside it is taking, so the two
 * stay in proportion at every setting.
 *
 * THE TOKEN TIMES THE SCALE, NOT AN sp-DERIVED SIZE, AND THE DIFFERENCE IS NOT ARITHMETIC. On this platform's
 * linear font scaling `20.sp.toDp()` computes the same number - but it spells the figure 20 a second time,
 * beside the token that already holds it, which is a value free to drift from Size.icon the day the token
 * moves (R206/R181: one home, and the text derived from it). Size.icon * fontScale has no second figure to
 * disagree with; it IS the token, scaled.
 *
 * IT IS SCOPED TO THE ANSWER LINE. Every other Icon in the app keeps Material3's fixed default, exactly as
 * AN-ANSWER-ICON left them - retrofitting them is a visual change to screens this task was not asked for.
 */
@Composable
internal fun answerGlyphSize(): Dp = Size.icon * LocalDensity.current.fontScale

/** One answered kind, as the reader sees it: the glyph, then the words it belongs to. */
internal data class AnswerLine(
    val label: String,
    val icon: Glyph,
)

/**
 * One line of the answer: the kind's glyph beside its own words. A half-day with two different answers
 * renders two of these, so each glyph sits beside the half it describes rather than both at the front
 * (R430).
 */
@Composable
internal fun AnswerKindLine(line: AnswerLine) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
    ) {
        val glyphId = glyphSemanticsId(line.icon)
        Icon(
            painter = glyphPainter(line.icon),
            contentDescription = null,
            tint = LightColors.textPrimary,
            modifier = Modifier.size(answerGlyphSize()).semantics { kindIconRes = glyphId },
        )
        Text(text = line.label, style = FrontierType.bodyM)
    }
}

/**
 * The answer's SYNC TRUTH: the words, the glyph that repeats them, and whether the server REFUSED the day
 * (which is what puts both in the error colour). One value built by one `when`, so the word and the glyph
 * cannot be set to disagree - before AN-POLISH the status was a String and a Boolean set side by side, and a
 * third field would have been a third thing to keep in step by hand (R206).
 */
internal data class AnswerStatus(
    val text: String,
    val icon: Glyph,
    val failed: Boolean,
)

/**
 * AN-POLISH (R435). The sync state as words AND a glyph. DESIGN-SYSTEM section 1 says « STATUS IS NEVER
 * COLOUR ALONE: colour + icon + text, always »; until now this line was colour + text, which satisfied the
 * rule's substance (three different sentences) and not its letter (no icon). AN-ANSWER-ICON reported that
 * rather than quietly fixing it, and the operator's answer is this.
 *
 * The three glyphs were ALREADY COMMITTED (AN10b, docs/lucide-icons.md) - no new drawable, no new
 * dependency: a clock for a day still on the phone, a tick for a day the server holds, a triangle for one it
 * refused.
 */
internal fun answerStatus(
    pending: Boolean,
    failed: Boolean,
): AnswerStatus =
    when {
        failed -> AnswerStatus(AujourdhuiCopy.SYNC_FAILED, Glyph.TRIANGLE_ALERT, failed = true)
        pending -> AnswerStatus(AujourdhuiCopy.PENDING, Glyph.CLOCK, failed = false)
        else -> AnswerStatus(AujourdhuiCopy.SYNCED, Glyph.CIRCLE_CHECK, failed = false)
    }

/**
 * The sync line: its glyph beside its own words, TINTED AS THE WORDS ARE - the error colour when the server
 * refused, the secondary text colour otherwise. contentDescription is null because the words say the same
 * thing (R430's reasoning, one row down), and the drawable id goes into the semantics for tests only
 * (design/StatusIconSemantics.kt).
 *
 * IT IS A DIFFERENT ROW FROM THE KIND GLYPH, as it has always been (R432). The kind sits above in
 * textPrimary and never changes with sync state; this sits below and never changes with the kind.
 */
@Composable
internal fun AnswerStatusLine(status: AnswerStatus) {
    val colour = if (status.failed) LightColors.error else LightColors.textSecondary
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
    ) {
        val glyphId = glyphSemanticsId(status.icon)
        Icon(
            painter = glyphPainter(status.icon),
            contentDescription = null,
            tint = colour,
            modifier = Modifier.size(answerGlyphSize()).semantics { statusIconRes = glyphId },
        )
        Text(text = status.text, style = FrontierType.caption, color = colour)
    }
}
