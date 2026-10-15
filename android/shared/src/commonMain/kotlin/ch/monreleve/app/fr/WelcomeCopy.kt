package ch.monreleve.app.fr

// AN-ONBOARD. The welcome screen (design/onboarding/Main.dc.html), shown on a fresh install only.
// Fully accented (R155), typographic apostrophes (R126 / U+2019). Reachable from
// ui/screens/signin/WelcomeScreen.kt (R238). Copy word for word from the approved mockup.

object WelcomeCopy {
    const val TITLE = "Vos jours de télétravail, prêts pour votre déclaration."

    const val FEATURE_RECORD = "Indiquez où vous travaillez, en un geste par jour."
    const val FEATURE_RELEVE = "Obtenez un relevé annuel à remettre à votre comptable."
    const val FEATURE_PRIVACY = "Aucune position n’est conservée. Vos données restent les vôtres."

    const val START = "Commencer"

    // The three feature icons, read by TalkBack (the glyphs are decorative on their own).
    const val FEATURE_RECORD_ICON = "Enregistrement quotidien"
    const val FEATURE_RELEVE_ICON = "Relevé annuel"
    const val FEATURE_PRIVACY_ICON = "Confidentialité"
}
