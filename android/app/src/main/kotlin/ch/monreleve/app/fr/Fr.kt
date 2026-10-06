package ch.monreleve.app.fr

/**
 * All user-facing Android strings (SPEC 5). No French string literal lives in a
 * composable; a composable reads from here. Fully accented (R155); the launcher
 * label is a platform string resource (res/values/strings.xml) by necessity.
 */
object Fr {
    /** The product name (web: lib/fr/index.ts's APP_NAME). Social rail card only (SPEC 6.3). */
    const val APP_NAME = "Mon Relevé"

    const val GREETING = "Bonjour Camille"

    /** The brand mark's content description (Bienvenue, Connexion, Tout est prêt) - one home (R206). */
    const val LOGO = "Logo Mon Relevé"
}
