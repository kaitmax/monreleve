package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.SignInCopy

// IOS-1b-A R604: MOVED FROM :app to :shared commonMain (package unchanged) - Aujourd'hui is one shared screen,
// hosted by Android's activity and by the iOS pilot.

// AN-PULL (R484). The year could not be brought down: what happened in words, and a retry. The info treatment of the
// near-border notice (AujourdhuiAuto.kt) - a fact to know, not an alarm: nothing was lost and nothing changed.
@Composable
internal fun YearDownloadNotice(onRetry: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.md))
                .background(LightColors.infoBg)
                .padding(Spacing.space12),
        verticalArrangement = Arrangement.spacedBy(Spacing.space8),
    ) {
        Text(text = AujourdhuiCopy.YEAR_DOWNLOAD_FAILED, style = FrontierType.caption)
        OutlinedButton(onClick = onRetry, shape = RoundedCornerShape(Radius.buttonLg)) {
            Text(text = SignInCopy.RETRY)
        }
    }
}
