package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.Elevation
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.tabularNums
import ch.monreleve.app.fr.Fr

/**
 * Placeholder Aujourd'hui (SPEC 11.2). AN1 renders the greeting and the hero
 * figure's SHAPE (Display, tabular, inside a radius-xl status card, no
 * shadow) with a placeholder value - the threshold rail and a real rate wait
 * for AN2's engine port. Every string comes from fr/, never a literal here.
 *
 * elevation = CardDefaults.cardElevation(defaultElevation = Elevation.none) is
 * explicit rather than relying on Card's default, which is non-zero - this is
 * the shape the increment-3 fence (no Material default shape or elevation)
 * checks every Card() call against.
 */
@Composable
fun AujourdhuiScreen() {
    Column(modifier = Modifier.padding(Spacing.space20)) {
        Text(text = Fr.GREETING, style = FrontierType.h2)

        Card(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.space16),
            // Radius.xl - the status card (SPEC 11.2)
            shape = MaterialTheme.shapes.extraLarge,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = Elevation.none),
        ) {
            Text(
                text = Fr.PLACEHOLDER_RATE,
                style = FrontierType.display.tabularNums(),
                modifier = Modifier.padding(Spacing.space24),
            )
        }
    }
}
