package ch.monreleve.app.fr

// AN-ONBOARD. The six-digit code screen (design/onboarding/Code.dc.html) - the second way in beside the
// link, and the relay's most important part. Fully accented (R155), typographic apostrophes (R126).
// Reachable from ui/screens/signin/CodeScreen.kt (R238).
//
// EACH REFUSAL SAYS HOW TO RECOVER, never just "erreur" (the relay's O1 / R198): a wrong code tells the
// person to check the digits or ask for a new one; an expired or spent request tells them to ask again.
// Authored here as the client's own copy, not lifted from the server's response string (R165).

object CodeCopy {
    const val TITLE = "Vérifiez votre messagerie"

    // "Nous avons envoyé un lien et un code à {email}." - the address is interpolated at the call site.
    const val SENT_TO_PREFIX = "Nous avons envoyé un lien et un code à "
    // "Modifier" has one home already: AujourdhuiCopy.MODIFIER (R206). The code screen references that.

    const val CODE_LABEL = "Code à 6 chiffres"

    /** TalkBack reads each box as "Chiffre N sur 6" (the relay's accessibility requirement). */
    fun digitLabel(position: Int): String = "Chiffre $position sur 6"

    const val ONE_TIME = "Le lien et le code ne fonctionnent qu’une seule fois."

    const val SUBMIT = "Valider le code"
    const val SUBMITTING = "Vérification…"
    const val OPEN_MAIL = "Ouvrir ma messagerie"
    const val NO_MAIL_APP = "Aucune application de messagerie n’est installée sur cet appareil."

    const val RESEND_NOW = "Rien reçu ?"
    const val RESEND = "Renvoyer un code"
    const val RESENDING = "Envoi…"

    /**
     * The full "Rien reçu ? Vous pourrez renvoyer un code dans 0:42." sentence (fence 4: no literal in the UI;
     * the prefix and the m:ss countdown are inlined here so they are not orphan exported constants, R238).
     */
    fun resendIn(seconds: Int): String {
        val safe = seconds.coerceAtLeast(0)
        val ss = (safe % 60).toString().padStart(2, '0')
        return "Rien reçu ? Vous pourrez renvoyer un code dans ${safe / 60}:$ss."
    }

    // Each named refusal, with how to recover. The network and generic cases reuse SignInCopy's (R206: one
    // home) - they are the same sign-in failures, worded once.
    // R376: TWO OF THESE POINT AT THE LINK NOW, because asking for a new code stopped being advice that
    // always works. FW-CODE-CAP added a per-address budget - ten code attempts per rolling 24 h, counted
    // in PostgreSQL across every code issued in that window - and once it is spent a NEW code is refused
    // on arrival. The client cannot tell the two causes apart, by design: the wire code and the status
    // are unchanged (R358), so one sentence has to be true for both (R165).
    //
    // The link in the same e-mail is the one recovery that works in every case: it never touches that
    // budget, and consuming it does not read the attempt counter.
    const val ERROR_WRONG_CODE =
        "Ce code n’est pas valable. Vérifiez les six chiffres et réessayez, " +
            "ou utilisez le lien de connexion contenu dans le même e-mail."

    // NOT CHANGED, and the reason is worth stating: requesting a code spends no budget - only an
    // EXCHANGE does. So "demandez-en un nouveau" is still true here, and pointing this one at the link
    // would be a worse sentence for no gain.
    const val ERROR_EXPIRED =
        "Ce code a expiré. Les codes ne sont valables que quelques minutes ; demandez-en un nouveau."
    const val ERROR_TOO_MANY =
        "Trop de tentatives. Par sécurité, ce code n’est plus accepté ; " +
            "utilisez le lien de connexion contenu dans le même e-mail."
    const val ERROR_RATE_LIMITED = "Trop de demandes depuis cet appareil. Patientez un instant, puis réessayez."
}
