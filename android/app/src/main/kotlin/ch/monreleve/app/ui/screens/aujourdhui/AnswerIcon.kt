package ch.monreleve.app.ui.screens.aujourdhui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.semantics
import ch.monreleve.app.R
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.kindIconRes

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

/** The Lucide glyph for a recorded kind. The ONE mapping; the tests assert the drawables, never this. */
@DrawableRes
internal fun kindIcon(kind: RecordedKind): Int =
    when (kind) {
        RecordedKind.SUISSE -> R.drawable.ic_building_2
        RecordedKind.DOMICILE -> R.drawable.ic_house
        RecordedKind.MISSION_FRANCE -> R.drawable.ic_briefcase
        RecordedKind.MISSION_THIRD -> R.drawable.ic_plane
        RecordedKind.ABSENCE -> R.drawable.ic_calendar_x
    }

/** One answered kind, as the reader sees it: the glyph, then the words it belongs to. */
internal data class AnswerLine(
    val label: String,
    @param:DrawableRes val icon: Int,
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
        Icon(
            painter = painterResource(line.icon),
            contentDescription = null,
            tint = LightColors.textPrimary,
            modifier = Modifier.size(Size.icon).semantics { kindIconRes = line.icon },
        )
        Text(text = line.label, style = FrontierType.bodyM)
    }
}
