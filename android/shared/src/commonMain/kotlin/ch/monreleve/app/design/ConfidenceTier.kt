package ch.monreleve.app.design

// IOS-1b-A R603: MOVED FROM :app to :shared commonMain (package unchanged) - the design system the shared Aujourd'hui
// screen draws with, one definition for both platforms.

// AN3 increment 4. Built from SPEC line 839 (see fr/ConfidenceCopy.kt's
// own header) - no existing web component to port from, since detection
// is AN6+ scope on both platforms.
//
// WORDS PLUS ICON PLUS THREE SEGMENTS, NEVER A PERCENTAGE (ruling R27).
// The three segments are a filled-count signal (1 of 3 for LOW, 2 of 3
// for MEDIUM, 3 of 3 for HIGH) - a coarse, ordinal shape rather than a
// number, so the visual cannot be misread as a precision the detection
// method does not have. Colour is never the only carrier: the word is
// always present alongside the segments (SPEC 966).

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import ch.monreleve.app.fr.ConfidenceCopy

enum class ConfidenceTier(val filledSegments: Int, val word: String) {
    LOW(1, ConfidenceCopy.LOW),
    MEDIUM(2, ConfidenceCopy.MEDIUM),
    HIGH(3, ConfidenceCopy.HIGH),
}

private const val TOTAL_SEGMENTS = 3

private fun segmentColour(
    tier: ConfidenceTier,
    filled: Boolean,
): Color =
    when {
        !filled -> LightColors.borderDefault
        tier == ConfidenceTier.LOW -> LightColors.warning
        else -> LightColors.success
    }

@Composable
fun ConfidenceTierBadge(
    tier: ConfidenceTier,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.semantics { contentDescription = tier.word },
    ) {
        Text(text = tier.word, style = FrontierType.caption, color = LightColors.textSecondary)
        Row(modifier = Modifier.padding(start = Spacing.space8)) {
            repeat(TOTAL_SEGMENTS) { index ->
                Box(
                    modifier =
                        Modifier
                            .padding(horizontal = Spacing.space4)
                            .size(Spacing.space8)
                            .background(
                                segmentColour(tier, index < tier.filledSegments),
                                RoundedCornerShape(Radius.xs),
                            ),
                )
            }
        }
    }
}
