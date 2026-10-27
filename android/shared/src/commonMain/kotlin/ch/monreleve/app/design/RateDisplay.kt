package ch.monreleve.app.design

// IOS-1b-A R603: MOVED FROM :app to :shared commonMain (package unchanged) - the design system the shared Aujourd'hui
// screen draws with, one definition for both platforms.

// AN3 increment 4. Kotlin port of web/lib/ui/react/RateDisplay/RateDisplay.tsx.
// The two rates (SPEC 9.3). Shown together only WHEN THEY DIFFER - a
// component that always rendered the second block would print the same
// percentage twice on every ordinary result, training the reader to
// ignore it.
//
// COLOURED BY Zone, never Status (SPEC 6.2) - this figure sits directly
// above the rail and is positioned by the same number.
//
// RULING R57's ONE EXCEPTION LIVES HERE, carried: the warning colour on
// text fails AA at body size (3.42:1), but at Display 48/600 this is
// LARGE text, where the bar is 3:1 - measured from the real tokens, not
// assumed. So the declarable rate MAY carry the band colour here, unlike
// ZoneBadge's label.
//
// EACH RATE ASKS FOR ITS OWN PRECISION (R97, carried): declarable
// truncates to 2 decimals (SPEC 7.3, the filed figure); raw keeps 1 (R26's
// second domain, a share of days).

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.fr.RatesCopy
import ch.monreleve.app.fr.text.formatDeclarableRate
import ch.monreleve.app.fr.text.formatPercent

private const val RAW_DECIMALS = 1

@Composable
fun RateDisplay(
    declarableRate: Double,
    zone: Zone,
    rawRate: Double? = null,
    modifier: Modifier = Modifier,
) {
    val bandColour = ZONE_BAND_COLOUR.getValue(zone)

    Column(modifier = modifier) {
        Text(
            // R479: the one formatting of the declarable rate - the forecast, the simulator and the releve use it too.
            text = formatDeclarableRate(declarableRate),
            style = FrontierType.display.tabularNums(),
            color = bandColour,
        )
        Text(text = RatesCopy.DECLARABLE_CAPTION, style = FrontierType.caption, color = LightColors.textSecondary)

        // The null check and the divergence check both live in one
        // condition on purpose: rawRate is smart-cast non-null inside the
        // block only when both are written together (a separate `val
        // diverges` computed earlier does not carry the smart cast here).
        if (rawRate != null && rawRate != declarableRate) {
            Column(modifier = Modifier.padding(top = Spacing.space12)) {
                Text(text = formatPercent(rawRate, RAW_DECIMALS), style = FrontierType.h3.tabularNums())
                Text(text = RatesCopy.RAW_CAPTION, style = FrontierType.caption, color = LightColors.textSecondary)
                Text(text = RatesCopy.DIVERGENCE, style = FrontierType.body, color = LightColors.textSecondary)
            }
        }
    }
}
