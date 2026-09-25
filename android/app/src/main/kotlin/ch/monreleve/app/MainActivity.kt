package ch.monreleve.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreen

/**
 * The single activity (SPEC 11). Compose Navigation and the four destinations
 * arrive in later tasks; AN1 launches to a placeholder Aujourd'hui, themed.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            FrontierTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    AujourdhuiScreen()
                }
            }
        }
    }
}
