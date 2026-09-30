package ch.monreleve.app.fr

// AN12 (SPEC 11.5). The Parametres screen's copy. Fully accented (R155), typographic apostrophes
// (R126 / U+2019). Reachable from ui/screens/parametres/ (R238).
//
// R206 - ONE TEXT, ONE HOME. The six calculation-field labels, hints and field errors are NOT restated
// here: the Parametres form reuses OnboardingCopy's, because they are the same fields the person set at
// onboarding and the same rules apply. This object holds only what is new to the settings screen - the
// title, the section heading, the "recalculates the year" warning, the save affordance, and R290's
// before/after dialog. "Enregistrer" and "Annuler" already have homes (CalendarCopy), so the strings here
// are the screen's own, more specific verbs rather than a second copy of a generic one.
//
// R153 / R181 - NAMES THE RULE, NEVER A VALUE. The before/after dialog says the taux declarable "changes"
// and shows the two figures the DEVICE ENGINE computes (formatPercent over deviceDeclarableRate); it never
// types a percentage. The warning names "l'ensemble de l'annee", not a threshold.
//
// R282 - NAMES NOTHING IT LACKS. No mode d'enregistrement, no rappel, no consentement, no automatic mode.

object ParametresCopy {
    const val TITLE = "Paramètres"

    // FD9's SITUATION PROFESSIONNELLE section: the settings that recompute the whole year, under a warning.
    const val SITUATION_HEADING = "Situation professionnelle"
    const val SITUATION_WARNING =
        "Ces réglages recalculent l’ensemble de l’année en cours. Ils doivent correspondre à la méthode " +
            "appliquée par votre employeur."

    const val SAVE = "Enregistrer les réglages"
    const val SAVING = "Enregistrement en cours…"
    const val SAVED_CONFIRMATION = "Réglage enregistré"

    // R290: shown BEFORE a consequential change is saved. The two figures come from the device engine over
    // the device's own entries; this copy names the effect, the screen renders the values.
    const val RATE_CHANGE_TITLE = "Cette modification recalcule votre année"
    const val RATE_CHANGE_BODY =
        "Votre taux déclarable pour l’année en cours change. Il est calculé à partir des journées déjà " +
            "enregistrées sur cet appareil."
    const val RATE_CHANGE_BEFORE_LABEL = "Actuellement"
    const val RATE_CHANGE_AFTER_LABEL = "Après enregistrement"
    const val RATE_CHANGE_CONFIRM = "Enregistrer la modification"
    const val RATE_CHANGE_CANCEL = "Conserver la valeur actuelle"

    // R290: a granularity switch the recorded days cannot support (a demi-journee under « journées entières »).
    const val ERROR_CHANGE_CONFLICTS =
        "Cette modification est incompatible avec des journées déjà enregistrées, qui utilisent un décompte " +
            "différent."

    // AN12 increment 2 - « Mes données » (AC2). Export goes through the platform share sheet.
    const val DATA_HEADING = "Mes données"
    const val EXPORT_JSON = "Exporter mes données (JSON)"
    const val EXPORT_CSV = "Exporter mes saisies (CSV)"
    const val EXPORT_HELPER = "Toutes vos saisies et leurs horodatages, tels que le serveur les conserve."

    // AN12 increment 2 - « Compte » and the R295 sign-out.
    const val ACCOUNT_HEADING = "Compte"
    const val SIGN_OUT = "Se déconnecter"
    const val SIGN_OUT_CONFIRM_TITLE = "Se déconnecter ?"
    const val SIGN_OUT_CONFIRM_BODY =
        "La déconnexion efface les données de cet appareil : vos journées enregistrées, le relevé en cache, " +
            "vos réglages de calcul et votre session. Vos réglages restent enregistrés sur le serveur et sont " +
            "rétablis à la reconnexion."
    const val SIGN_OUT_CANCEL = "Rester connecté"

    /**
     * PARKAN-27: the unsynced-loss warning, naming the count in a sentence (R181 - the number is a live value,
     * derived from the record, not a constant to type). Shown only when at least one recorded day has not yet
     * synced: those days never reached the server and cannot be recovered once Room is wiped (R295).
     */
    fun unsyncedWarning(days: Int): String =
        if (days == 1) {
            "1 journée enregistrée sur cet appareil n’a pas encore été synchronisée : elle sera " +
                "définitivement perdue."
        } else {
            "$days journées enregistrées sur cet appareil n’ont pas encore été synchronisées : elles seront " +
                "définitivement perdues."
        }

    // AN12 increment 3 - suppression du compte (D11, R289, FD9 A2). The destructive row and its confirmation.
    const val DELETE_ROW = "Supprimer mon compte"
    const val DELETE_ROW_HELPER = "Supprime définitivement votre compte, vos saisies et votre relevé."

    // The dialog title IS the row's words (R206 - one home; a literal here would be the same string twice).
    const val DELETE_TITLE = DELETE_ROW
    const val DELETE_INTRO = "Cette action supprime définitivement :"
    const val DELETE_ITEM_PROVENANCE = "l’origine de chaque saisie (détectée, corrigée, manuelle)"
    const val DELETE_ITEM_RELEVE = "votre relevé annuel de télétravail"
    const val DELETE_ITEM_ACCOUNT = "votre compte et votre adresse e-mail"
    const val DELETE_IRREVERSIBLE =
        "Cette action est irréversible. Votre relevé ne pourra pas être régénéré, même en réinstallant " +
            "l’application."
    const val DELETE_EXPORT_OFFER = "Vous pouvez d’abord exporter vos données."
    const val DELETE_CONFIRM = "Supprimer définitivement"
    const val DELETE_CANCEL = "Conserver mon compte"

    /** FD9 A2's first destruction line: the recorded days and their timestamps, named with the count. */
    fun deleteEntriesItem(days: Int): String =
        if (days == 1) {
            "1 saisie et son horodatage d’enregistrement"
        } else {
            "$days saisies et leurs horodatages d’enregistrement"
        }

    /** The typed-word gate. `word` is DELETE_CONFIRMATION (R206) - one home for the value the server compares. */
    fun deleteTypePrompt(word: String): String = "Pour confirmer, saisissez $word."

    // The outcome, surfaced afterwards (§14.1 / §14.3 - the receipt and the alert-list note are obligations).
    const val DELETE_DONE_TITLE = "Compte supprimé"
    const val DELETE_ALERT_REMAINS =
        "Votre adresse reste inscrite aux alertes réglementaires. Le lien de désinscription figure dans " +
            "ces e-mails."
    const val DELETE_DONE_ACK = "Terminer"
    const val DELETE_REFUSED =
        "La suppression a échoué : votre compte et les données de cet appareil sont intacts. Vous pouvez réessayer."
    const val DELETE_UNKNOWN =
        "La suppression n’a pas pu être confirmée. Les données de cet appareil sont intactes ; vérifiez votre " +
            "connexion avant de réessayer."
    const val DELETE_ACK = "Fermer"

    fun deleteDoneBody(entries: Int): String =
        if (entries == 1) {
            "Votre compte et votre saisie ont été supprimés définitivement du serveur et de cet appareil."
        } else {
            "Votre compte et vos $entries saisies ont été supprimés définitivement du serveur et de cet appareil."
        }

    // AN12 increment 4 - « À propos » (FD9). The legal pages open in the browser from the configured site URL;
    // the licences screen opens in the app (R280). R282: nothing here names a mode, a reminder or detection.
    const val ABOUT_HEADING = "À propos"
    const val PRIVACY_ROW = "Politique de confidentialité"
    const val TERMS_ROW = "Conditions générales d’utilisation"
    const val LEGAL_ROW = "Mentions légales"
    const val SOURCES_ROW = "Sources réglementaires"

    // The row label IS the licences screen's title (R206 - one home, not the same literal twice).
    const val LICENCES_ROW = LicencesCopy.TITLE
    const val VERSION_ROW = "Version"

    const val ABOUT_DISCLAIMER_1 = "Cette application enregistre et met en forme vos journées."
    const val ABOUT_DISCLAIMER_2 = "Elle ne constitue pas un conseil fiscal."

    /** The version line, « nom (code) », built by the composition root from BuildConfig (R181 - not typed). */
    fun version(
        name: String,
        code: String,
    ): String = "$name ($code)"
}
