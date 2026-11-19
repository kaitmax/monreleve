package ch.monreleve.app.ui.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.SignInCopy

// AN-SIGNIN-RESOLVE (R1161). THE RESOLVING SCREEN: the wait for GET /me after a sign-in, and - new - what it shows when
// the server gave no answer it could act on. Until this task there was no such state: an unreachable or unreadable
// /me fell through to the EMPTY onboarding (R1160), whose finished form overwrites a returning person's settings.
// Now [message] is shown with a retry instead, and nothing is decided until the server answers. A pure UI component:
// the decision is StartupDecider's, the words are fr/'s (SignInCopy, the screen this one follows - its retry button
// and its two failure lines, referenced rather than copied, R206), the treatment is the releve's error state
// (ReleveScreen).

/** RESOLVING: a spinner while [message] is null; otherwise [message] and a retry. */
@Composable
fun ResolvingScreen(
    message: String?,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (message == null) {
            CircularProgressIndicator()
        } else {
            Text(text = message, style = FrontierType.body, color = LightColors.textPrimary)
            Button(onClick = onRetry, shape = RoundedCornerShape(Radius.buttonLg)) {
                Text(text = SignInCopy.RETRY)
            }
        }
    }
}
