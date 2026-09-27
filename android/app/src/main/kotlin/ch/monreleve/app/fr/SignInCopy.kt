package ch.monreleve.app.fr

// AN4 increment 3. The sign-in request screen (SPEC 11.1). Fully accented (R155),
// typographic apostrophes (R126 / U+2019, matching RatesCopy's "l'AFC").
// Reachable from ui/screens/signin/RequestLinkScreen.kt (R238).
//
// SENT_BODY says "si un compte existe" on purpose: the server does not reveal
// whether an address is registered (docs/api-v1.md 1.5), and the client must not
// either - ONE message whatever happened. Authored here as the client's own copy,
// not lifted from the server's response string (R165).

object SignInCopy {
    const val TITLE = "Connexion"
    const val PROMPT = "Entrez votre adresse e-mail. Un lien de connexion vous y sera envoyé."
    const val EMAIL_LABEL = "Adresse e-mail"
    const val SUBMIT = "Recevoir le lien"
    const val SUBMITTING = "Envoi en cours…"

    const val SENT_TITLE = "Vérifiez votre boîte mail"
    const val SENT_BODY =
        "Si un compte existe pour cette adresse, un lien de connexion vient d’y être " +
            "envoyé. Il est valable quelques minutes et ne fonctionne qu’une fois."

    const val RATE_LIMITED = "Trop de demandes de connexion. Patientez quelques minutes avant de réessayer."
    const val NETWORK_ERROR = "Connexion impossible. Vérifiez votre connexion, puis réessayez."
    const val GENERIC_ERROR = "Une erreur s’est produite. Réessayez."
    const val RETRY = "Réessayer"
}
