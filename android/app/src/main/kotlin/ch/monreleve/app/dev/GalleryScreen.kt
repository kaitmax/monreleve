package ch.monreleve.app.dev

// AN3 increment 6. AC3's instrument: every component this task built, in
// every state, under one scrollable screen. NOT reachable from any
// production entry point - MainActivity never references this package;
// GalleryActivity (this same package) is the only way in, launched
// directly by component name (see its own header for why it is exported
// with no LAUNCHER intent filter). R186: nothing here flips a product
// state, and nothing here is a SPEC 11 screen - the walkthrough that
// reads this screen's own screenshots is the acceptance criterion, not
// this file (AC3, relay/AN3.txt).
//
// SPLIT ACROSS THREE FILES (this one, GalleryRailSection.kt,
// GalleryComponentSections.kt), each a LazyListScope extension function
// per section: a single file listing all seven sections inline was 153
// lines and tripped detekt's LongMethod, and even split into one function
// per section the FILE itself tripped TooManyFunctions (11) - the same
// fix this codebase already uses for a long Composable (ThresholdRail.kt's
// private drawX helpers), one level up at the screen rather than the
// canvas, and then one level up again at the file.

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.ZoneThresholds
import ch.monreleve.app.fr.GalleryCopy

internal val RULES = ruleSetFor(2026)
internal val THRESHOLDS = ZoneThresholds(RULES.fiscalCeiling, RULES.socialCeiling)
internal val ITEM_BOTTOM: Modifier = Modifier.padding(bottom = Spacing.space20)

@Composable
internal fun SectionHeader(text: String) {
    Text(
        text = text,
        style = FrontierType.h2,
        modifier = Modifier.padding(top = Spacing.space20, bottom = Spacing.space8),
    )
}

@Composable
internal fun Caption(text: String) {
    Text(text = text, style = FrontierType.caption, modifier = Modifier.padding(bottom = Spacing.space4))
}

@Composable
fun GalleryScreen(modifier: Modifier = Modifier) {
    LazyColumn(modifier = modifier.fillMaxSize().padding(horizontal = Spacing.space20)) {
        item {
            Text(
                text = GalleryCopy.TITLE,
                style = FrontierType.h1,
                modifier = Modifier.padding(top = Spacing.space20),
            )
        }
        railInlineSection()
        railOtherSection()
        badgeSection()
        rateSection()
        tileSection()
        dayCellSection()
        formattersSection()
        confidenceSection()
    }
}

@Composable
fun GalleryRoot() {
    FrontierTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            GalleryScreen()
        }
    }
}
