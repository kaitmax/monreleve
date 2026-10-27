package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import platform.UIKit.UIAccessibilityIsReduceMotionEnabled

// IOS-1b-A R604. iOS's half of rememberReduceMotion (ChoiceMotion.kt): the system's Reduce Motion setting, the
// platform's own equivalent of Android's "Remove animations" - on, every choice transition becomes snap().
@Composable
internal actual fun rememberReduceMotion(): Boolean = remember { UIAccessibilityIsReduceMotionEnabled() }
