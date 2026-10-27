package ch.monreleve.app.ui.screens.aujourdhui

import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

// IOS-1b-A R604. Android's half of rememberReduceMotion (ChoiceMotion.kt) - the body the :app version had, unchanged:
// with "Remove animations" on (animator duration scale 0) every choice transition becomes snap().
@Composable
internal actual fun rememberReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}
