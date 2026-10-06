package ch.monreleve.app.ui.screens.signin

// AN-ONBOARD. The code screen's callbacks, bundled (the OnboardingActions pattern) so CodeScreen takes
// (email, state, actions, modifier) rather than eight parameters - and the no-literal fence need not meet a
// @Suppress string in ui/ (LongParameterList ignores data classes). Its own file (MatchingDeclarationName).
data class CodeActions(
    val onCodeChange: (String) -> Unit,
    val onSubmit: () -> Unit,
    val onModify: () -> Unit,
    val onResend: () -> Unit,
    val onOpenMail: () -> Unit,
)
