package ch.monreleve.app.ui.screens.aujourdhui

import android.provider.Settings
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
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntSize
import ch.monreleve.app.design.Motion

// AN-HOME section 1. The choice card's motion, split out of ChoiceCard.kt so neither file carries too many
// functions (the no-inline-string ui/ fence forbids a @Suppress here, so the split is the honest fix, not a
// suppression). Reused by the manual ChoiceCard and by the auto ETAT C slot (AujourdhuiAuto.kt).
//
// The durations are Motion tokens, never inline numbers (Fence 8). With Android's "Remove animations" on
// (animator duration scale 0) every transition becomes snap() - instant, nothing left half-drawn.

/** True when Android's "Remove animations" accessibility setting is on (animator duration scale 0). */
@Composable
internal fun rememberReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}

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
