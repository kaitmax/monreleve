package ch.monreleve.app.design

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.painter.Painter
import ch.monreleve.app.shared.resources.Res
import ch.monreleve.app.shared.resources.ic_bell
import ch.monreleve.app.shared.resources.ic_briefcase
import ch.monreleve.app.shared.resources.ic_building_2
import ch.monreleve.app.shared.resources.ic_calendar_check
import ch.monreleve.app.shared.resources.ic_calendar_x
import ch.monreleve.app.shared.resources.ic_chevron_left
import ch.monreleve.app.shared.resources.ic_circle_check
import ch.monreleve.app.shared.resources.ic_circle_x
import ch.monreleve.app.shared.resources.ic_clock
import ch.monreleve.app.shared.resources.ic_file_text
import ch.monreleve.app.shared.resources.ic_house
import ch.monreleve.app.shared.resources.ic_info
import ch.monreleve.app.shared.resources.ic_lock
import ch.monreleve.app.shared.resources.ic_logo_mark
import ch.monreleve.app.shared.resources.ic_mail
import ch.monreleve.app.shared.resources.ic_octagon_alert
import ch.monreleve.app.shared.resources.ic_plane
import ch.monreleve.app.shared.resources.ic_triangle_alert
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.painterResource

// IOS-1b-A R603. iOS DRAWS THE APP'S OWN DRAWABLE FILES, GENERATED INTO ITS COMPOSE RESOURCES (Glyph.kt).
//
// :shared's generateGlyphResources copies app/src/main/res/drawable/ic_*.xml into a generated directory registered
// as iosMain's Compose Multiplatform resources, so every accessor below exists only because the file does - a glyph
// whose file is missing is a compile error here, not a blank image at run time. The `when` is exhaustive over Glyph.

// IOS-2a R767: eighteen flat arms are a lookup table, not branching logic - detekt counts each arm as a path. The
// exhaustive `when` stays because it is the compile-time proof that every Glyph has a generated resource (above).
@Suppress("CyclomaticComplexMethod")
private fun Glyph.resource(): DrawableResource =
    when (this) {
        Glyph.BUILDING_2 -> Res.drawable.ic_building_2
        Glyph.HOUSE -> Res.drawable.ic_house
        Glyph.BRIEFCASE -> Res.drawable.ic_briefcase
        Glyph.PLANE -> Res.drawable.ic_plane
        Glyph.CALENDAR_X -> Res.drawable.ic_calendar_x
        Glyph.CLOCK -> Res.drawable.ic_clock
        Glyph.CIRCLE_CHECK -> Res.drawable.ic_circle_check
        Glyph.TRIANGLE_ALERT -> Res.drawable.ic_triangle_alert
        Glyph.CIRCLE_X -> Res.drawable.ic_circle_x
        Glyph.OCTAGON_ALERT -> Res.drawable.ic_octagon_alert
        Glyph.CHEVRON_LEFT -> Res.drawable.ic_chevron_left
        Glyph.INFO -> Res.drawable.ic_info
        Glyph.LOGO_MARK -> Res.drawable.ic_logo_mark
        Glyph.MAIL -> Res.drawable.ic_mail
        Glyph.CALENDAR_CHECK -> Res.drawable.ic_calendar_check
        Glyph.FILE_TEXT -> Res.drawable.ic_file_text
        Glyph.LOCK -> Res.drawable.ic_lock
        Glyph.BELL -> Res.drawable.ic_bell
    }

@Composable
actual fun glyphPainter(glyph: Glyph): Painter = painterResource(glyph.resource())

@Composable
actual fun glyphSemanticsId(glyph: Glyph): Int = glyph.ordinal
