package ch.monreleve.app.ui.screens.signin

// AN-ONBOARD. The email screen's callbacks, bundled (the OnboardingActions pattern) so RequestLinkScreen
// takes (state, actions, modifier) rather than eight parameters - and the no-literal fence need not meet a
// @Suppress string in ui/ (LongParameterList ignores data classes). Its own file (MatchingDeclarationName).
data class SignInActions(
    val onEmailChange: (String) -> Unit,
    val onSubmit: () -> Unit,
    val onRetry: () -> Unit,
    val onBack: () -> Unit,
    val onOpenCgu: () -> Unit,
    val onOpenPrivacy: () -> Unit,
)
