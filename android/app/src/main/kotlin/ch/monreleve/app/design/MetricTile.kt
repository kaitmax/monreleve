package ch.monreleve.app.design

// AN3 increment 4. Kotlin port of web/lib/ui/react/MetricTile/MetricTile.tsx.
//
// IT TAKES A SignedDays, NOT A NUMBER - the whole design (SPEC 7.2 step 6):
// a headroom of -6 is not minus six days of headroom, it is six days OVER,
// a different sentence about a different quantity. The sign is rendered
// as WORDS (a swapped label) and the figure turns red; no minus character
// is ever emitted, because formatSignedDays's own text never carries one.
//
// RULING R73 - IT OWNS NO COPY. Both labels arrive from the caller, the
// only layer holding the year's RuleSet - a threshold named here would be
// a second source of truth. BOTH LABELS ARE REQUIRED (no default for
// overLabel): SPEC 7.2 step 6 makes "a negative figure never appears
// under a remaining label" a product invariant, and an optional
// over-label would let a caller ship exactly that by omission.

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.fr.text.SignedDays

@Composable
fun MetricTile(
    label: String,
    overLabel: String,
    days: SignedDays,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(
            text = if (days.negative) overLabel else label,
            style = FrontierType.caption,
            color = LightColors.textSecondary,
        )
        Text(
            text = days.text,
            style = FrontierType.h2.tabularNums(),
            color = if (days.negative) LightColors.error else LightColors.textPrimary,
        )
    }
}
