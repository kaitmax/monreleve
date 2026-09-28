package ch.monreleve.app.ui.screens.signin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.auth.CallbackPhase
import ch.monreleve.app.auth.CallbackState
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.CallbackCopy

// AN4 increment 4 (AC2). Renders the callback phase. Reads a CallbackState (auth/)
// and one callback - never data/remote (fence 5). Every failure state names what
// the person does next; the working state is a plain line while the exchange runs.

@Composable
fun CallbackScreen(
    state: CallbackState,
    onBackToSignIn: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        when (state.phase) {
            CallbackPhase.WORKING -> Text(text = CallbackCopy.WORKING, style = FrontierType.body)
            CallbackPhase.SIGNED -> {
                Text(text = CallbackCopy.SIGNED_TITLE, style = FrontierType.h1)
                Text(text = CallbackCopy.SIGNED_BODY, style = FrontierType.body)
            }
            CallbackPhase.INVALID_LINK -> CallbackError(CallbackCopy.INVALID_LINK, onBackToSignIn)
            CallbackPhase.MALFORMED -> CallbackError(CallbackCopy.MALFORMED, onBackToSignIn)
            CallbackPhase.MISMATCH -> CallbackError(CallbackCopy.MISMATCH, onBackToSignIn)
            CallbackPhase.NETWORK_ERROR -> CallbackError(CallbackCopy.NETWORK_ERROR, onBackToSignIn)
            CallbackPhase.GENERIC_ERROR -> CallbackError(CallbackCopy.GENERIC_ERROR, onBackToSignIn)
        }
    }
}

@Composable
private fun CallbackError(
    message: String,
    onBackToSignIn: () -> Unit,
) {
    Text(text = message, style = FrontierType.body)
    Button(onClick = onBackToSignIn, modifier = Modifier.fillMaxWidth()) {
        Text(text = CallbackCopy.BACK_TO_SIGN_IN)
    }
}
