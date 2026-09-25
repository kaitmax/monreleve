package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import ch.monreleve.app.fr.Fr

/**
 * Placeholder Aujourd'hui (SPEC 11.2). AN1 renders only the greeting; the status
 * card, the rate figure with tabular numerals and the threshold rail are wired
 * once FrontierTheme lands (increment 2) and the engine ports (AN2). The string
 * comes from fr/, never a literal here.
 */
@Composable
fun AujourdhuiScreen() {
    Text(text = Fr.GREETING)
}
