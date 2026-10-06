package ch.monreleve.app.ui.screens.signin

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import ch.monreleve.app.R
import ch.monreleve.app.auth.CODE_LENGTH
import ch.monreleve.app.auth.CodePhase
import ch.monreleve.app.auth.CodeState
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CodeCopy
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.ui.screens.onboarding.BackButton
import ch.monreleve.app.ui.screens.onboarding.BottomActions
import ch.monreleve.app.ui.screens.onboarding.GapHeight
import ch.monreleve.app.ui.screens.onboarding.IconCircle
import ch.monreleve.app.ui.screens.onboarding.PrimaryButton
import ch.monreleve.app.ui.screens.onboarding.SecondaryButton

// AN-ONBOARD. The six-digit code screen (design/onboarding/Code.dc.html): the second way in beside the
// link. Six boxes with focus advancement and paste, the address shown with "Modifier", a visible resend
// countdown, "Ouvrir ma messagerie", and a named recovery message per refusal. No string literal (fence 4).

@Composable
fun CodeScreen(
    email: String,
    state: CodeState,
    actions: CodeActions,
    modifier: Modifier = Modifier,
) {
    val submitting = state.phase == CodePhase.SUBMITTING
    Column(modifier = modifier.fillMaxSize()) {
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.space8)) {
            BackButton(contentDescription = AujourdhuiCopy.MODIFIER, onBack = actions.onModify)
        }
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.space24),
            verticalArrangement = Arrangement.spacedBy(Spacing.space20),
        ) {
            IconCircle(
                iconRes = R.drawable.ic_mail,
                contentDescription = CodeCopy.TITLE,
                diameter = Spacing.space64,
                iconSize = Spacing.space28,
            )
            Text(text = CodeCopy.TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
            SentToLine(email = email, onModify = actions.onModify)
            CodeBoxes(code = state.code, enabled = !submitting, onCodeChange = actions.onCodeChange)
            Text(text = CodeCopy.ONE_TIME, style = FrontierType.body, color = LightColors.textSecondary)
            errorMessage(state.phase)?.let { Text(text = it, style = FrontierType.body, color = LightColors.error) }
            GapHeight(Spacing.space8)
        }
        BottomActions {
            PrimaryButton(
                label = if (submitting) CodeCopy.SUBMITTING else CodeCopy.SUBMIT,
                onClick = actions.onSubmit,
                enabled = !submitting && state.code.length == CODE_LENGTH,
            )
            SecondaryButton(label = CodeCopy.OPEN_MAIL, onClick = actions.onOpenMail)
            ResendLine(state = state, onResend = actions.onResend)
        }
    }
}

@Composable
private fun SentToLine(
    email: String,
    onModify: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        Text(
            text = CodeCopy.SENT_TO_PREFIX + email,
            style = FrontierType.bodyL,
            color = LightColors.textSecondary,
        )
        Text(
            text = AujourdhuiCopy.MODIFIER,
            style = FrontierType.bodyM,
            color = LightColors.brand,
            modifier = Modifier.clickable { onModify() },
        )
    }
}

@Composable
private fun CodeBoxes(
    code: String,
    enabled: Boolean,
    onCodeChange: (String) -> Unit,
) {
    val focus = remember { List(CODE_LENGTH) { FocusRequester() } }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Text(text = CodeCopy.CODE_LABEL, style = FrontierType.caption, color = LightColors.textPrimary)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
        ) {
            repeat(CODE_LENGTH) { i ->
                OutlinedTextField(
                    value = code.getOrNull(i)?.toString() ?: "",
                    onValueChange = { raw -> onBoxChange(raw, i, code, focus, onCodeChange) },
                    enabled = enabled,
                    singleLine = true,
                    textStyle = FrontierType.h3.copy(textAlign = TextAlign.Center),
                    keyboardOptions =
                        KeyboardOptions(
                            keyboardType = KeyboardType.NumberPassword,
                            imeAction = if (i == CODE_LENGTH - 1) ImeAction.Done else ImeAction.Next,
                        ),
                    modifier =
                        Modifier
                            .weight(1f)
                            .focusRequester(focus[i])
                            .semantics { contentDescription = CodeCopy.digitLabel(i + 1) },
                )
            }
        }
    }
}

// One box changed: a single digit sets this box and advances; empty clears from here back; a pasted run of
// digits fills all six. The controller auto-submits once six digits are present.
private fun onBoxChange(
    raw: String,
    index: Int,
    code: String,
    focus: List<FocusRequester>,
    onCodeChange: (String) -> Unit,
) {
    val digits = raw.filter(Char::isDigit)
    when {
        digits.length >= CODE_LENGTH -> {
            onCodeChange(digits.take(CODE_LENGTH))
            runCatching { focus[CODE_LENGTH - 1].requestFocus() }
        }
        digits.isEmpty() -> {
            onCodeChange(code.take(index))
            if (index > 0) runCatching { focus[index - 1].requestFocus() }
        }
        else -> {
            onCodeChange(code.take(index) + digits.takeLast(1))
            if (index < CODE_LENGTH - 1) runCatching { focus[index + 1].requestFocus() }
        }
    }
}

@Composable
private fun ResendLine(
    state: CodeState,
    onResend: () -> Unit,
) {
    val canResend = state.resendSeconds <= 0 && !state.resending
    if (canResend) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Text(text = CodeCopy.RESEND_NOW, style = FrontierType.body, color = LightColors.textSecondary)
            Spacer(modifier = Modifier.width(Spacing.space4))
            Text(
                text = if (state.resending) CodeCopy.RESENDING else CodeCopy.RESEND,
                style = FrontierType.bodyM,
                color = LightColors.brand,
                modifier = Modifier.clickable { onResend() },
            )
        }
    } else {
        Text(
            text = CodeCopy.resendIn(state.resendSeconds),
            style = FrontierType.body,
            color = LightColors.textSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

private fun errorMessage(phase: CodePhase): String? =
    when (phase) {
        CodePhase.WRONG_CODE -> CodeCopy.ERROR_WRONG_CODE
        CodePhase.EXPIRED -> CodeCopy.ERROR_EXPIRED
        CodePhase.TOO_MANY -> CodeCopy.ERROR_TOO_MANY
        CodePhase.RATE_LIMITED -> CodeCopy.ERROR_RATE_LIMITED
        // The same sign-in failures, worded once (R206).
        CodePhase.NETWORK_ERROR -> SignInCopy.NETWORK_ERROR
        CodePhase.GENERIC_ERROR -> SignInCopy.GENERIC_ERROR
        else -> null
    }
