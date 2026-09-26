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

    /**
     * The Aujourd'hui hero figure (SPEC 11.2) is a placeholder until AN2 ports
     * the engine - an explicit, honest zero rather than a computed-looking
     * number, so nobody mistakes it for a real rate.
     */
    const val PLACEHOLDER_RATE = "0,0 %"
}
