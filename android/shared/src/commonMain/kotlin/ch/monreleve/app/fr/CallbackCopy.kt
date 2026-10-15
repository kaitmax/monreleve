package ch.monreleve.app.fr

// AN4 increment 4 (AC2). The App Link callback screen states. Fully accented
// (R155), typographic apostrophes (R126). Reachable from
// ui/screens/signin/CallbackScreen.kt (R238).
//
// INVALID_LINK is the client's own copy for the server's single invalid_link 400
// (unknown/expired/used/wrong-address collapsed). MALFORMED and MISMATCH are
// states the CLIENT decides before any exchange: a broken URI, and a valid link
// for an account this device did not request (login-CSRF). Each says what the
// person does next.

object CallbackCopy {
    const val WORKING = "Connexion en cours…"

    const val SIGNED_TITLE = "Vous êtes connecté"
    const val SIGNED_BODY = "Votre session est ouverte sur cet appareil."

    const val INVALID_LINK =
        "Ce lien n’est plus valable. Les liens de connexion expirent après quelques " +
            "minutes et ne fonctionnent qu’une fois ; demandez-en un nouveau depuis l’application."
    const val MALFORMED = "Ce lien est incomplet ou incorrect. Demandez un nouveau lien depuis l’application."
    const val MISMATCH = "Ce lien ne correspond pas à la demande de connexion en cours sur cet appareil."
    const val NETWORK_ERROR = "Connexion impossible. Vérifiez votre connexion, puis rouvrez le lien."
    const val GENERIC_ERROR = "La connexion a échoué. Demandez un nouveau lien depuis l’application."

    const val BACK_TO_SIGN_IN = "Revenir à la connexion"
}
