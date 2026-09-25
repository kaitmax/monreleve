package ch.monreleve.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreen

/**
 * The single activity (SPEC 11). Compose Navigation and the four destinations
 * arrive in later tasks; AN1 launches to a placeholder Aujourd'hui.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AujourdhuiScreen()
        }
    }
}
