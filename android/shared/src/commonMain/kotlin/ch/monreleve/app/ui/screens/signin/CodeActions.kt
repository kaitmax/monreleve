package ch.monreleve.app.ui.screens.signin

// AN-ONBOARD. The code screen's callbacks, bundled (the OnboardingActions pattern) so CodeScreen takes
// (email, state, actions, modifier) rather than eight parameters - and the no-literal fence need not meet a
// @Suppress string in ui/ (LongParameterList ignores data classes). Its own file (MatchingDeclarationName).
data class CodeActions(
    val onCodeChange: (String) -> Unit,
    val onSubmit: () -> Unit,
    val onModify: () -> Unit,
    val onResend: () -> Unit,
    /**
     * « Ouvrir ma messagerie ». IOS-SHELL-2 (R1333, iOS Ruling 3 Q5): NULL where this phone cannot open a mail app -
     * iOS asks canOpenURL for message:// - and the screen then shows no such button. No handler, no button: one fact,
     * never a second flag beside it (onToggleAutoDetection's rule, R1124). Android always passes one (its own
     * fallback, R299, says why when no mail app answers).
     */
    val onOpenMail: (() -> Unit)?,
)
