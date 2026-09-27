package ch.monreleve.app.ui.screens.signin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import ch.monreleve.app.auth.SignInPhase
import ch.monreleve.app.auth.SignInState
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.SignInCopy

// AN4 increment 3. The sign-in request screen (SPEC 11.1): one field, one primary
// button, French from fr/, the IME action submits. It reads a SignInState (from
// auth/) and calls back - it never touches data/remote (fence 5). The check-email,
// rate-limited and error phases each render their own honest state; there is no
// phase that reveals whether the address is registered.

@Composable
fun RequestLinkScreen(
    state: SignInState,
    onEmailChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = SignInCopy.TITLE, style = FrontierType.h1)
        when (state.phase) {
            SignInPhase.EDITING, SignInPhase.SUBMITTING -> RequestForm(state, onEmailChange, onSubmit)
            SignInPhase.LINK_SENT -> SentMessage()
            SignInPhase.RATE_LIMITED -> ErrorMessage(SignInCopy.RATE_LIMITED, onRetry)
            SignInPhase.NETWORK_ERROR -> ErrorMessage(SignInCopy.NETWORK_ERROR, onRetry)
            SignInPhase.GENERIC_ERROR -> ErrorMessage(SignInCopy.GENERIC_ERROR, onRetry)
        }
    }
}

@Composable
private fun RequestForm(
    state: SignInState,
    onEmailChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    val submitting = state.phase == SignInPhase.SUBMITTING
    Text(text = SignInCopy.PROMPT, style = FrontierType.body)
    OutlinedTextField(
        value = state.email,
        onValueChange = onEmailChange,
        label = { Text(text = SignInCopy.EMAIL_LABEL) },
        singleLine = true,
        enabled = !submitting,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { onSubmit() }),
        modifier = Modifier.fillMaxWidth(),
    )
    Button(onClick = onSubmit, enabled = !submitting, modifier = Modifier.fillMaxWidth()) {
        Text(text = if (submitting) SignInCopy.SUBMITTING else SignInCopy.SUBMIT)
    }
}

@Composable
private fun SentMessage() {
    Text(text = SignInCopy.SENT_TITLE, style = FrontierType.h3)
    Text(text = SignInCopy.SENT_BODY, style = FrontierType.body)
}

@Composable
private fun ErrorMessage(
    message: String,
    onRetry: () -> Unit,
) {
    Text(text = message, style = FrontierType.body)
    Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) {
        Text(text = SignInCopy.RETRY)
    }
}
