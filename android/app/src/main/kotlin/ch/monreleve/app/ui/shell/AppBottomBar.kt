package ch.monreleve.app.ui.shell

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import ch.monreleve.app.fr.NavCopy

// AN10. The app's bottom navigation (SPEC 11). Two items TONIGHT - Aujourd'hui and Calendrier - because
// those are the two screens that exist; a tab pointing at an unbuilt Releve or Parametres would be the
// dead route R85 forbids (R282: never advertise what is not there). AN11 and AN12 each add their own
// item when their screen lands. A pure UI component: no data layer (fence 5), copy from fr/, colours
// and the active tint from FrontierTheme (active = brand).
//
// ICONS ARE THE COMPOSE MATERIAL CORE SET, no new dependency (the ZoneBadge precedent: the core set is
// bundled with material3; the extended set is a separate dependency this task does not add). FD6 draws
// lucide `sun` and `calendar`; the core set has no `sun`, so Home stands in for Aujourd'hui and
// DateRange for Calendrier - by role, not by exact glyph, named in the report AGAINST THE RULINGS. The
// visible label carries each destination's name, so the icon is decorative (contentDescription null).

@Composable
fun AppBottomBar(
    selected: AppTab,
    onSelect: (AppTab) -> Unit,
) {
    NavigationBar {
        NavigationBarItem(
            selected = selected == AppTab.AUJOURDHUI,
            onClick = { onSelect(AppTab.AUJOURDHUI) },
            icon = { Icon(imageVector = Icons.Filled.Home, contentDescription = null) },
            label = { Text(text = NavCopy.AUJOURDHUI) },
        )
        NavigationBarItem(
            selected = selected == AppTab.CALENDRIER,
            onClick = { onSelect(AppTab.CALENDRIER) },
            icon = { Icon(imageVector = Icons.Filled.DateRange, contentDescription = null) },
            label = { Text(text = NavCopy.CALENDRIER) },
        )
    }
}
