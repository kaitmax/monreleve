package ch.monreleve.app.design

// AN3 increment 4. Kotlin port of web/lib/ui/react/ZoneBadge/ZoneBadge.tsx.
// The status chip. SPEC 6.2: "Every status carries icon + label +
// one-line explanation, identical on web, Android, and PDF." SPEC 16:
// never colour-only. All three parts are mandatory in all four states.
//
// COLOURS PER RULING R57 (carried), overriding the naive reading on
// measured grounds: #B7791F on #FFF7E6 is 3.42:1 and fails AA for normal
// text.
//
//   label        textPrimary on the soft fill      (large surface, AA)
//   icon         the status colour                 (non-text, 3:1 bar)
//   explanation  textPrimary on the surface
//
// IT TAKES A Status AND NOTHING ELSE - no Zone prop exists, so "coloured
// by Status, never by Zone" is not a rule a caller could break; there is
// no channel.
//
// ICONS: Compose's own Material CORE icon set (androidx.compose.material.icons,
// bundled transitively with material3 - verified empirically, not assumed:
// the core runtime jar was unzipped and its available Filled icon names
// listed directly, since Cancel/Report/Error/Block all turned out to
// resolve only in material-icons-EXTENDED, a separate dependency this task
// does not add). CORE'S OWN 48 names are Add, AddCircle, ArrowBack/Drop/
// Forward, Build, Call, Check, CheckCircle, Clear, Close, Create, Date
// Range, Delete, Done, Edit, Email, ExitToApp, Face, Favorite(Border),
// Home, Info, KeyboardArrow*, List, LocationOn, Lock, MailOutline, Menu,
// MoreVert, Notifications, Person, Phone, Place, PlayArrow, Refresh,
// Search, Send, Settings, Share, ShoppingCart, Star, ThumbUp, Warning -
// no octagon, block or generic error glyph exists in it. Mapped for
// visual distinctness within that real constraint: CheckCircle/Warning/
// Clear/Notifications stand in for circle-check/triangle-alert/circle-x/
// octagon-alert - the last two chosen for shape, not name.

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import ch.monreleve.app.R

// R293 (AN10b): the four status glyphs are now the REAL Lucide icons, converted to vector drawables and
// committed (no runtime dependency, R136), replacing AN3's Material core stand-ins. Each is the glyph
// LucideIconName names - circle-check, triangle-alert, circle-x, octagon-alert - not a shape chosen for
// visual distinctness within the core set's real constraint. Icon(tint) recolours the stroke.
@DrawableRes
private fun iconFor(icon: LucideIconName): Int =
    when (icon) {
        LucideIconName.CIRCLE_CHECK -> R.drawable.ic_circle_check
        LucideIconName.TRIANGLE_ALERT -> R.drawable.ic_triangle_alert
        LucideIconName.CIRCLE_X -> R.drawable.ic_circle_x
        LucideIconName.OCTAGON_ALERT -> R.drawable.ic_octagon_alert
    }

@Composable
fun ZoneBadge(
    status: Status,
    modifier: Modifier = Modifier,
) {
    val presentation = STATUS_PRESENTATION.getValue(status)

    Column(modifier = modifier) {
        Row(
            modifier =
                Modifier
                    .background(presentation.softColour, RoundedCornerShape(Radius.pill))
                    .padding(horizontal = Spacing.space12, vertical = Spacing.space8)
                    .semantics(mergeDescendants = true) {},
        ) {
            // The glyph is decorative: the label beside it says the same
            // thing in words, and SPEC 16 requires the words. Announcing
            // both would read the status twice.
            Icon(
                painter = painterResource(iconFor(presentation.icon)),
                contentDescription = null,
                tint = presentation.colour,
                modifier = Modifier.padding(end = Spacing.space4),
            )
            Text(text = presentation.label, style = FrontierType.bodyM, color = LightColors.textPrimary)
        }
        Text(
            text = presentation.explanation,
            style = FrontierType.body,
            color = LightColors.textPrimary,
            modifier = Modifier.padding(top = Spacing.space4),
        )
    }
}
