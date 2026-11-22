package ch.monreleve.app.ui.shell

import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemColors
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.semantics
import ch.monreleve.app.design.Glyph
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.glyphPainter
import ch.monreleve.app.design.glyphSemanticsId
import ch.monreleve.app.design.navIconRes
import ch.monreleve.app.fr.NavCopy

// AN10. The app's bottom navigation (SPEC 11). Two items - Aujourd'hui and Calendrier - because those
// are the two screens that exist; a tab pointing at an unbuilt Releve or Parametres would be the dead
// route R85 forbids (R282). AN11 and AN12 each add their own item when their screen lands. A pure UI
// component: no data layer (fence 5), copy from fr/, colours and the active tint from FrontierTheme.
//
// ICONS ARE LUCIDE (R293, AN10b), converted to vector drawables and committed - no runtime dependency
// (R136). FD6/FD7/FD9 draw lucide `sun` (Aujourd'hui), `calendar` (Calendrier), `file-text` (Releve) and
// `settings` (Parametres); those exact glyphs ship as res/drawable/ic_sun, ic_calendar, ic_file_text and
// ic_settings. The visible label carries each destination's name, so the icon is decorative
// (contentDescription null). AN12 shows the `settings` tab now that the Parametres screen exists (R282).
//
// AN-CAL2 defect 4. DESIGN-SYSTEM.md section 1 BOTTOM NAV: "active = brand colour, inactive = neutral. No
// oversized pill." Material3's NavigationBarItem defaults draw an indicator PILL in colorScheme
// .secondaryContainer (here switzerlandSoft, a pale pink) behind the selected item, and tint the selected
// icon/label in onSecondaryContainer (switzerlandText, a red) - the stock M3 look leaking past FrontierTheme.
// Overridden HERE, once, for every item: the indicator is transparent (no pill), the selected icon and label
// are brand, the unselected ones neutral (textSecondary). Fixed at the navigation component so every screen
// is corrected at once; a screenshot baseline (AppBottomBarScreenshotTest) holds it so the pill cannot return.

@Composable
private fun brandNavItemColors(): NavigationBarItemColors =
    NavigationBarItemDefaults.colors(
        selectedIconColor = LightColors.brand,
        selectedTextColor = LightColors.brand,
        indicatorColor = Color.Transparent,
        unselectedIconColor = LightColors.textSecondary,
        unselectedTextColor = LightColors.textSecondary,
    )

@Composable
fun AppBottomBar(
    selected: AppTab,
    onSelect: (AppTab) -> Unit,
) {
    val colors = brandNavItemColors()
    NavigationBar {
        NavigationBarItem(
            selected = selected == AppTab.AUJOURDHUI,
            onClick = { onSelect(AppTab.AUJOURDHUI) },
            icon = { BarIcon(Glyph.SUN) },
            label = { Text(text = NavCopy.AUJOURDHUI) },
            colors = colors,
        )
        NavigationBarItem(
            selected = selected == AppTab.CALENDRIER,
            onClick = { onSelect(AppTab.CALENDRIER) },
            icon = { BarIcon(Glyph.CALENDAR) },
            label = { Text(text = NavCopy.CALENDRIER) },
            colors = colors,
        )
        NavigationBarItem(
            selected = selected == AppTab.RELEVE,
            onClick = { onSelect(AppTab.RELEVE) },
            icon = { BarIcon(Glyph.FILE_TEXT) },
            label = { Text(text = NavCopy.RELEVE) },
            colors = colors,
        )
        NavigationBarItem(
            selected = selected == AppTab.PARAMETRES,
            onClick = { onSelect(AppTab.PARAMETRES) },
            icon = { BarIcon(Glyph.SETTINGS) },
            label = { Text(text = NavCopy.PARAMETRES) },
            colors = colors,
        )
    }
}

// IOS-SHELL-1 (R1326): each icon carries its glyph's id (design/NavIconSemantics.kt) for the render proof to read. The
// semantics draw nothing, so the bar's pixels are unchanged on both platforms.
@Composable
private fun BarIcon(glyph: Glyph) {
    val glyphId = glyphSemanticsId(glyph)
    Icon(
        painter = glyphPainter(glyph),
        contentDescription = null,
        modifier = Modifier.semantics { navIconRes = glyphId },
    )
}
