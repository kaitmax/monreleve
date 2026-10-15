package ch.monreleve.app.fr

/**
 * All user-facing Android strings (SPEC 5). No French string literal lives in a
 * composable; a composable reads from here. Fully accented (R155); the launcher
 * label is a platform string resource (res/values/strings.xml) by necessity.
 */
object Fr {
    /** The product name (web: lib/fr/index.ts's APP_NAME). Social rail card only (SPEC 6.3). */
    const val APP_NAME = "Mon Relevé"

    /** The greeting prefix; the template below adds the holder's first name when there is one. */
    private const val BONJOUR = "Bonjour"

    /**
     * The Aujourd'hui header greeting (AN-HOME section A, SPEC 11.2). PARKAN-50: it greets the SIGNED-IN
     * account's holder name (Settings.name, the onboarding titulaire), its FIRST name - so « Camille Martin »
     * reads « Bonjour Camille », the header this screen has always shown, now from DATA rather than a
     * hard-coded person. The name is interpolated DATA, never a copy constant (R153/R181: the copy names the
     * rule's input, it does not hard-code a value).
     *
     * NULL-SAFE (R156 conservative fallback, recorded): a not-yet-named account - the AN-ONBOARD-2 partial
     * case, a canton without a name that can still reach Aujourd'hui - is greeted « Bonjour » alone, never a
     * stray or blank name. The first name is the first whitespace-delimited token after trimming; a
     * hyphenated first name (« Jean-Pierre ») is kept whole.
     */
    fun greeting(holderName: String?): String {
        val firstName = holderName?.trim()?.takeIf { it.isNotEmpty() }?.substringBefore(' ')
        return if (firstName == null) BONJOUR else "$BONJOUR $firstName"
    }

    /** The brand mark's content description (Bienvenue, Connexion, Tout est prêt) - one home (R206). */
    const val LOGO = "Logo Mon Relevé"
}
