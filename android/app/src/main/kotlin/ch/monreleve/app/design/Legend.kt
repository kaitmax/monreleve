package ch.monreleve.app.design

// AN3 increment 4. No direct web component to port from - built from the
// relay's own requirement: "a test asserts a legend exists wherever a
// DayCell grid does - letters need a key (R119's shape)." R119's own
// point carried across: a specified-once element (here, a legend) is
// asserted by PRESENCE wherever its grid is, not assumed to follow from
// the grid existing.

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.fr.LegendCopy

@Composable
fun DayKindLegend(modifier: Modifier = Modifier) {
    Row(modifier = modifier) {
        DayKind.entries.forEach { kind ->
            Row(modifier = Modifier.padding(end = Spacing.space12)) {
                Text(text = kind.letter, style = FrontierType.micro)
                Text(
                    text = LegendCopy.forKind(kind.letter),
                    style = FrontierType.micro,
                    modifier = Modifier.padding(start = Spacing.space4),
                )
            }
        }
    }
}
