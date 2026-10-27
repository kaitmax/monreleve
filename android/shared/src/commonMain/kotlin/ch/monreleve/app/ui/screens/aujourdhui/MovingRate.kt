package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

// IOS-1b-A R604: MOVED FROM :app to :shared commonMain (package unchanged) - Aujourd'hui is one shared screen,
// hosted by Android's activity and by the iOS pilot.

// AN-GRANULARITY (R495). The year card's moving rate, split from AujourdhuiScreen.kt to keep that file within detekt's
// per-file function budget (the ReleveSections / PrevisionRail split idiom). The figure it returns is what RateDisplay
// and ThresholdRail state; RateFloatFenceTest reads this file as part of the rate's path.

// IOS-1b-A R604: public, not internal - DeclarableRateDisplayTest in :app reads it across the module boundary.

/**
 * AN-GRANULARITY (R495). NO Float CARRIES THE DECLARABLE RATE TO THIS SCREEN - not at rest, not in between.
 *
 * A Float cannot hold most hundredths: 0.83 is 0.829999983..., which the declarable rate's truncation (SPEC 7.3)
 * states as 0,82 - so Aujourd'hui once read 0,82 % where the forecast read 0,83 % for the same record (REPORT-KMP-4
 * NOTICED 2), and Geneva's 39,16 % would have read 39,15 %. AN-CALENDAR (R479) handed the engine's Double over when the
 * Float animation came to rest; the frames in between still showed the Float. Now the animation never touches the
 * rate: what animates is the PROGRESS of a change, 0 to 1, and the figure is computed from the two Doubles on either
 * side of it. At rest the progress is 1 and the figure IS the engine's Double; in between it is a Double between them.
 * RateFloatFenceTest refuses a rate converted to, animated as, or held in a Float anywhere on the path.
 */
fun rateBetween(
    from: Double,
    to: Double,
    progress: Float,
): Double = if (progress >= 1f) to else from + (to - from) * progress

/**
 * The declarable rate as it changes: the engine's [target] at rest, a Double between the previous figure and the new
 * one while the change is animating (over [spec], instant when animations are removed). Only the progress is a Float.
 */
@Composable
internal fun rememberMovingRate(
    target: Double,
    spec: AnimationSpec<Float>,
): Double {
    var from by remember { mutableDoubleStateOf(target) }
    var to by remember { mutableDoubleStateOf(target) }
    val progress = remember { Animatable(1f) }
    LaunchedEffect(target) {
        if (target != to) {
            // A change arriving mid-animation starts from where the figure stands now, never with a jump back.
            from = rateBetween(from, to, progress.value)
            to = target
            progress.snapTo(0f)
            progress.animateTo(1f, spec)
        }
    }
    return rateBetween(from, to, progress.value)
}
