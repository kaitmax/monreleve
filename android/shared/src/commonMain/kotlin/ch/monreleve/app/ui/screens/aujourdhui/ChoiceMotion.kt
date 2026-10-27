package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.IntSize
import ch.monreleve.app.design.Motion

// IOS-1b-A R604: MOVED FROM :app to :shared commonMain (package unchanged) - Aujourd'hui is one shared screen,
// hosted by Android's activity and by the iOS pilot.

// AN-HOME section 1. The choice card's motion, split out of ChoiceCard.kt so neither file carries too many
// functions (the no-inline-string ui/ fence forbids a @Suppress here, so the split is the honest fix, not a
// suppression). Reused by the manual ChoiceCard and by the auto ETAT C slot (AujourdhuiAuto.kt).
//
// The durations are Motion tokens, never inline numbers (Fence 8). With Android's "Remove animations" on
// (animator duration scale 0) every transition becomes snap() - instant, nothing left half-drawn.

/**
 * True when the platform's reduce-motion setting is on: Android's "Remove animations" (animator duration scale 0,
 * ReduceMotion.android.kt - the code this was, unchanged) or iOS's Reduce Motion (ReduceMotion.ios.kt).
 */
@Composable
internal expect fun rememberReduceMotion(): Boolean

// reduce -> snap() (instant); otherwise the 200 ms standard token. Two typed helpers because fade works on
// Float and expand/shrink on IntSize. Block bodies so the formatter does not collapse them onto one long line.
private fun floatSpec(reduce: Boolean): FiniteAnimationSpec<Float> {
    return if (reduce) snap() else tween(Motion.standardMillis)
}

private fun sizeSpec(reduce: Boolean): FiniteAnimationSpec<IntSize> {
    return if (reduce) snap() else tween(Motion.standardMillis)
}

internal fun optionsEnter(reduce: Boolean): EnterTransition {
    return fadeIn(floatSpec(reduce)) + expandVertically(sizeSpec(reduce))
}

internal fun optionsExit(reduce: Boolean): ExitTransition {
    return fadeOut(floatSpec(reduce)) + shrinkVertically(sizeSpec(reduce))
}

internal fun answerEnter(reduce: Boolean): EnterTransition {
    return fadeIn(floatSpec(reduce))
}

internal fun answerExit(reduce: Boolean): ExitTransition {
    return fadeOut(floatSpec(reduce))
}
