package ch.monreleve.app.fr

// AN-ONBOARD (was AN4). The email sign-in screen (design/onboarding/Connexion.dc.html). Fully accented
// (R155), typographic apostrophes (R126 / U+2019). Reachable from ui/screens/signin/ConnexionScreen.kt
// (R238).
//
// After submit the flow moves to the CODE screen (CodeCopy), which is where "vérifiez votre messagerie"
// now lives - so there is no "sent" state on this screen. The copy says nothing about whether the address
// is registered (docs/api-v1.md 1.5); the server does not reveal it and the client must not either.

object SignInCopy {
    const val TITLE = "Se connecter à Mon Relevé"
    const val PROMPT = "Pas de mot de passe : nous vous envoyons un lien et un code à usage unique."
    const val EMAIL_LABEL = "Adresse e-mail"
    const val EMAIL_PLACEHOLDER = "prenom.nom@exemple.ch"
    const val SUBMIT = "Recevoir mon lien de connexion"
    const val SUBMITTING = "Envoi en cours…"

    // The consent line, in parts so the two links are clickable (no literal in the composable). The privacy
    // label reuses ParametresCopy.PRIVACY_ROW and "Retour"/the logo reuse LicencesCopy.BACK/Fr.LOGO (R206).
    const val CONSENT_PREFIX = "En continuant, vous acceptez les "
    const val CONSENT_CGU = "Conditions d’utilisation"
    const val CONSENT_AND = " et la "
    const val CONSENT_SUFFIX = "."

    const val RATE_LIMITED = "Trop de demandes de connexion. Patientez quelques minutes avant de réessayer."
    const val NETWORK_ERROR = "Connexion impossible. Vérifiez votre connexion, puis réessayez."
    const val GENERIC_ERROR = "Une erreur s’est produite. Réessayez."
    const val RETRY = "Réessayer"
}
