package ch.monreleve.app.ui.screens.signin

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import ch.monreleve.app.auth.SignInPhase
import ch.monreleve.app.auth.SignInState
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.Fr
import ch.monreleve.app.fr.LicencesCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.ui.screens.onboarding.BackButton
import ch.monreleve.app.ui.screens.onboarding.BottomActions
import ch.monreleve.app.ui.screens.onboarding.GapHeight
import ch.monreleve.app.ui.screens.onboarding.LogoMark
import ch.monreleve.app.ui.screens.onboarding.PrimaryButton

// AN-ONBOARD (was AN4). The email sign-in screen (design/onboarding/Connexion.dc.html): logo, the
// passwordless prompt, one email field, the consent line with its two links, and the primary button.
// After submit the flow moves to the CODE screen (the LINK_SENT phase is handled by the caller, which
// navigates); this screen renders only the form and any error. No string literal here (fence 4).

@Composable
fun RequestLinkScreen(
    state: SignInState,
    actions: SignInActions,
    modifier: Modifier = Modifier,
) {
    val submitting = state.phase == SignInPhase.SUBMITTING
    Column(modifier = modifier.fillMaxSize()) {
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.space8)) {
            BackButton(contentDescription = LicencesCopy.BACK, onBack = actions.onBack)
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
            LogoMark(contentDescription = Fr.LOGO, diameter = Spacing.space40)
            Text(text = SignInCopy.TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
            Text(text = SignInCopy.PROMPT, style = FrontierType.bodyL, color = LightColors.textSecondary)
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
                Text(text = SignInCopy.EMAIL_LABEL, style = FrontierType.caption, color = LightColors.textPrimary)
                OutlinedTextField(
                    value = state.email,
                    onValueChange = actions.onEmailChange,
                    placeholder = { Text(text = SignInCopy.EMAIL_PLACEHOLDER, style = FrontierType.body) },
                    singleLine = true,
                    enabled = !submitting,
                    keyboardOptions =
                        KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { actions.onSubmit() }),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            ErrorLine(state.phase, actions.onRetry)
            GapHeight(Spacing.space8)
        }
        BottomActions {
            PrimaryButton(
                label = if (submitting) SignInCopy.SUBMITTING else SignInCopy.SUBMIT,
                onClick = actions.onSubmit,
                enabled = !submitting,
            )
            ConsentLine(onOpenCgu = actions.onOpenCgu, onOpenPrivacy = actions.onOpenPrivacy)
        }
    }
}

@Composable
private fun ErrorLine(
    phase: SignInPhase,
    onRetry: () -> Unit,
) {
    val message =
        when (phase) {
            SignInPhase.RATE_LIMITED -> SignInCopy.RATE_LIMITED
            SignInPhase.NETWORK_ERROR -> SignInCopy.NETWORK_ERROR
            SignInPhase.GENERIC_ERROR -> SignInCopy.GENERIC_ERROR
            else -> null
        }
    if (message != null) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
            Text(text = message, style = FrontierType.body, color = LightColors.error)
            Text(
                text = SignInCopy.RETRY,
                style = FrontierType.bodyM,
                color = LightColors.brand,
                modifier = Modifier.clickable { onRetry() },
            )
        }
    }
}

@Composable
private fun ConsentLine(
    onOpenCgu: () -> Unit,
    onOpenPrivacy: () -> Unit,
) {
    val link = SpanStyle(color = LightColors.brand, textDecoration = TextDecoration.Underline)
    val text =
        buildAnnotatedString {
            append(SignInCopy.CONSENT_PREFIX)
            withLink(LinkAnnotation.Clickable(SignInCopy.CONSENT_CGU) { onOpenCgu() }) {
                withStyle(link) { append(SignInCopy.CONSENT_CGU) }
            }
            append(SignInCopy.CONSENT_AND)
            withLink(LinkAnnotation.Clickable(ParametresCopy.PRIVACY_ROW) { onOpenPrivacy() }) {
                withStyle(link) { append(ParametresCopy.PRIVACY_ROW) }
            }
            append(SignInCopy.CONSENT_SUFFIX)
        }
    Text(
        text = text,
        style = FrontierType.caption.copy(color = LightColors.textSecondary),
        modifier = Modifier.fillMaxWidth(),
    )
}
