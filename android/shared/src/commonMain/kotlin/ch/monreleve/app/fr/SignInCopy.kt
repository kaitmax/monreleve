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

    /**
     * AN-FORCED-SIGNOUT (R520). What this screen says when the person did not end their session - the server did:
     * a refused renewal, a revoke-all, a replayed token. It says what happened and how many days wait on this
     * phone, a live count read from the record when the screen renders (R181), never typed.
     *
     * IT DOES NOT ALARM (R210's copy rule). « fermée », never « volée » or « compromise »: the same sentence has to
     * be true for somebody whose session merely could not be renewed, and it must not say which case fired.
     * « pour les envoyer » states the purpose, not a promise - a send can fail, and the days then wait for the
     * next one (PARK-T4).
     *
     * AT ZERO IT STILL SPEAKS. « Votre session a été fermée » is true with nothing held, and it is the only thing
     * that tells somebody why they are looking at a sign-in screen they did not ask for; only the days clause goes.
     */
    fun sessionClosed(heldDays: Int): String =
        when (heldDays) {
            0 -> "Votre session a été fermée. Reconnectez-vous pour continuer."
            1 ->
                "Votre session a été fermée. 1 journée enregistrée sur ce téléphone attend d’être envoyée : " +
                    "reconnectez-vous avec la même adresse pour l’envoyer."
            else ->
                "Votre session a été fermée. $heldDays journées enregistrées sur ce téléphone attendent d’être " +
                    "envoyées : reconnectez-vous avec la même adresse pour les envoyer."
        }

    const val RATE_LIMITED = "Trop de demandes de connexion. Patientez quelques minutes avant de réessayer."
    const val NETWORK_ERROR = "Connexion impossible. Vérifiez votre connexion, puis réessayez."
    const val GENERIC_ERROR = "Une erreur s’est produite. Réessayez."
    const val RETRY = "Réessayer"
}
