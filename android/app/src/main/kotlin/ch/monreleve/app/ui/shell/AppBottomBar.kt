package ch.monreleve.app.ui.shell

import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.painterResource
import ch.monreleve.app.R
import ch.monreleve.app.fr.NavCopy

// AN10. The app's bottom navigation (SPEC 11). Two items - Aujourd'hui and Calendrier - because those
// are the two screens that exist; a tab pointing at an unbuilt Releve or Parametres would be the dead
// route R85 forbids (R282). AN11 and AN12 each add their own item when their screen lands. A pure UI
// component: no data layer (fence 5), copy from fr/, colours and the active tint from FrontierTheme.
//
// ICONS ARE LUCIDE (R293, AN10b), converted to vector drawables and committed - no runtime dependency
// (R136). FD6 draws lucide `sun` (Aujourd'hui) and `calendar` (Calendrier); those exact glyphs now ship
// as res/drawable/ic_sun and ic_calendar, replacing AN10's Home/DateRange stand-ins (PARKAN-23 reverses
// PARKAN-21). The visible label carries each destination's name, so the icon is decorative
// (contentDescription null). `file-text` (AN11 Releve) and `settings` (AN12 Parametres) are also
// committed, ready for their tabs, but are NOT shown here - no tab for a screen that does not exist yet.

@Composable
fun AppBottomBar(
    selected: AppTab,
    onSelect: (AppTab) -> Unit,
) {
    NavigationBar {
        NavigationBarItem(
            selected = selected == AppTab.AUJOURDHUI,
            onClick = { onSelect(AppTab.AUJOURDHUI) },
            icon = { Icon(painter = painterResource(R.drawable.ic_sun), contentDescription = null) },
            label = { Text(text = NavCopy.AUJOURDHUI) },
        )
        NavigationBarItem(
            selected = selected == AppTab.CALENDRIER,
            onClick = { onSelect(AppTab.CALENDRIER) },
            icon = { Icon(painter = painterResource(R.drawable.ic_calendar), contentDescription = null) },
            label = { Text(text = NavCopy.CALENDRIER) },
        )
    }
}
