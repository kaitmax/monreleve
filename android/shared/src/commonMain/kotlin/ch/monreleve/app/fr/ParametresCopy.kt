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
// R315 REVERSES R282 FOR AUTOMATIC DETECTION. R282 kept the manual product from naming a feature it lacked;
// the feature now exists (opt-in, labelled beta), so the choice appears here. NOWHERE does the app suggest
// manual is the lesser option (D19): the description states both modes produce the same annual statement, and
// the toggle defaults off. The rappel/consentement rows R282 excluded stay out - only auto detection arrives.

object ParametresCopy {
    const val TITLE = "Paramètres"

    // R315 - « Détection automatique (beta) ». Opt-in, manual by default, a plain Switch (no dialog, SPEC 13).
    // The label carries the beta word; the description says it is optional and that manual is its equal, never
    // its fallback. R27: no percentage. The disclosure before the OS prompt is D5/R316's (increment 3).
    const val AUTO_HEADING = "Enregistrement"

    // R206 - ONE HOME. « Détection automatique (bêta) » is DetectionCopy.MODE_AUTO (AN-NEXT-2 / R325 corrected
    // it with its accent). AN12 had typed it unaccented here, so the two differed and the duplication guard did
    // not see them; AN-PARAMS corrects the accent AND points this at the one home, so « bêta » cannot drift.
    const val AUTO_LABEL = DetectionCopy.MODE_AUTO

    // AN-PARAMS: the switch row shows ONE line; the full disclosure (AUTO_DESCRIPTION, AUTO_BETA_NOTE,
    // AUTO_BATTERY_NOTE) moves behind « En savoir plus » (R282/R312/R317 honest disclosures are not deleted,
    // only relocated - a test keeps each reachable, R238). Honest and modest: it PROPOSES, the person confirms.
    const val AUTO_SUMMARY =
        "En option, l’application peut déterminer vos journées sur le téléphone et vous les proposer à confirmer."

    // AN-PARAMS: reveals the full detection disclosure (and any other relocated explanation) in a sheet. A
    // generic affordance; « En savoir plus » has no prior home, so it is defined here where it is first used.
    const val LEARN_MORE = "En savoir plus"

    // AN-COPY-TRUTH-2 (R1230): the parity sentence names the origin as the one difference (A6 section 3) and
    // keeps « les deux se valent » (D19).
    const val AUTO_DESCRIPTION =
        "En option, l’application peut déterminer sur votre téléphone si votre journée a été passée en Suisse " +
            "ou à domicile, et vous la proposer chaque soir à confirmer. La saisie manuelle aboutit au même relevé " +
            "annuel, aux mêmes chiffres ; seule l’origine indiquée pour chaque journée change, et les deux se valent."
    const val AUTO_BETA_NOTE =
        "Fonction en bêta : sa fiabilité est en cours de mesure. L’application vous propose une journée " +
            "seulement lorsqu’elle en est sûre, et vous indique quand elle ne l’est pas."

    // R317: do NOT ask for a battery-optimisation exemption (that permission is itself restricted on Play).
    // Instead, say in words that the phone's battery management may stop background sampling, and link to
    // nothing that changes a system setting on the person's behalf - manual entry is the fallback.
    const val AUTO_BATTERY_NOTE =
        "Certains téléphones (dont des Samsung) peuvent interrompre la détection en arrière-plan pour " +
            "économiser la batterie. Si une journée n’est pas détectée, saisissez-la manuellement ; " +
            "l’application ne modifie aucun réglage système à votre place."

    // R323 / PARKAN-36: the evening proposal toggle. OPT-IN, SEPARATE from detection, OFF by default. Worded as a
    // « proposition » the person is prévenu of about once a day - never a « rappel » that nags (the rules forbid a
    // second reminder or a « vous avez oublié »), which is also why ParametresR282Test (the parked FCM reminder
    // must stay unnamed) needs no change: « prévenir », not « rappel » / « notification ». Shown only when
    // detection is on - without it there is nothing to propose.
    const val EVENING_LABEL = "Me prévenir le soir"
    const val EVENING_DESCRIPTION =
        "Quand la détection automatique est active, l’application peut vous prévenir le soir si une journée de " +
            "travail n’a pas encore été enregistrée, pour que vous la confirmiez ou la corrigiez. Une seule fois " +
            "par jour, jamais le week-end."

    // AN-ALERT: the threshold alert toggle. OPT-IN, OFF by default, SEPARATE from detection and the evening
    // reminder (it reads the forecast, not the position). R153/R181: a const cannot reach the RuleSet, so the
    // description names the seuils rather than typing « 40 % » / « 49,9 % ».
    const val ALERT_LABEL = "M’avertir si j’approche d’un seuil"
    const val ALERT_DESCRIPTION =
        "Une alerte la première fois que votre rythme prévu dépasserait le seuil fiscal ou le seuil de sécurité " +
            "sociale. Une projection, jamais votre relevé."

    // FD9's SITUATION PROFESSIONNELLE section: the settings that recompute the whole year, under a warning.
    const val SITUATION_HEADING = "Situation professionnelle"

    // AN-PARAMS: shown as the « Début d’activité » row's value when no start date is stored - the person
    // has worked (or will work) the whole year. The stored value stays an ISO day string (R28); this is the
    // empty display only. The date itself is shown in the Swiss format (formatDate, dd.MM.yyyy) when present.
    const val START_DATE_EMPTY = "Toute l’année"

    // AN-PARAMS: the start date is now picked with Material 3's date picker, not typed as AAAA-MM-JJ (the
    // storage format was leaking onto the screen). This labels the button that opens the picker and the
    // picker's own confirm action; « Toute l’année » (START_DATE_EMPTY) clears it to the whole-year case.
    const val START_DATE_PICK = "Choisir une date"

    // AN-PARAMS: this « recalculates the year » warning is no longer an always-visible amber box (a permanent
    // warning stops reading as one). It moves INTO each work-setting edit sheet, where it is made concrete by
    // R290's before/after when a save would move the year's rate.
    const val SITUATION_WARNING =
        "Ces réglages recalculent l’ensemble de l’année en cours. Ils doivent correspondre à la méthode " +
            "appliquée par votre employeur."

    // AN-PARAMS: the floating « Enregistrer les réglages » button is GONE (one way of saving - each work
    // setting is edited and saved in its own sheet, which reuses CalendarCopy.SHEET_SAVE/SHEET_CANCEL,
    // R206). SAVING stays - the sheet shows it while a save is in flight. The « Réglage enregistré »
    // confirmation is dropped in favour of observation (the sheet closes, the row shows the new value -
    // the CalendarEditSheet precedent, DESIGN-SYSTEM « no success animation »).
    const val SAVING = "Enregistrement en cours…"

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

    // AN-PARAMS: one « Exporter mes données » row that opens a chooser offering the two documents below
    // (the complete JSON record and the CSV entries). Distinct from EXPORT_JSON's value, so no duplication.
    const val DATA_EXPORT_ROW = "Exporter mes données"
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

    // AN-POLISH (R440). SIGNING OUT TRIES TO SEND BEFORE IT DISCARDS ANYTHING. Sign-out wipes this device
    // (R295), so a day still only on the phone goes with it - a person on a bad connection could lose a week
    // of declarations with one tap. The app now attempts ONE bounded sync of the current account's pending
    // days first, and says so while it runs.
    const val SIGN_OUT_SENDING = "Envoi des journées en attente…"

    /**
     * R440: what is LEFT after that attempt - the COUNT and the DATES. A count alone leaves the person
     * guessing which days they are about to lose, which is the one thing this dialog exists to tell them.
     * Both are live figures derived from the record, never typed (R181); the dates arrive already formatted,
     * because fr/format is in :app and this file is in :shared.
     *
     * IT IS NOT unsyncedWarning. That one is the DELETE dialog's (and sign-out's, before this): "not yet
     * synchronised". This one is said AFTER a send was attempted and failed, which is a different claim -
     * « n'a pas pu être envoyée », not « n'a pas encore été synchronisée ».
     */
    fun stillPendingWarning(
        days: Int,
        dates: String,
    ): String =
        if (days == 1) {
            "1 journée n’a pas pu être envoyée : $dates. Elle sera définitivement perdue si vous vous " +
                "déconnectez maintenant."
        } else {
            "$days journées n’ont pas pu être envoyées : $dates. Elles seront définitivement perdues si " +
                "vous vous déconnectez maintenant."
        }

    /**
     * The dates in that warning, joined. STATED rather than left to joinToString's default (R345: a default
     * is a setting nobody chose), and here rather than in the screen because fence 4 forbids a String literal
     * anywhere under ui/.
     */
    fun dateList(formattedDates: List<String>): String = formattedDates.joinToString(", ")

    /**
     * R440: try the send again, so « se déconnecter quand même » is not the only way forward. It REFERENCES
     * the one home for that word (SignInCopy.RETRY, which had it first) rather than being a second literal -
     * R206, and CopyDuplicationTest caught the second literal on its first run, which is the guard working
     * rather than a near miss.
     */
    const val SIGN_OUT_RETRY = SignInCopy.RETRY

    /** R440: leave with the loss, knowingly. Distinct from SIGN_OUT - this one names the cost. */
    const val SIGN_OUT_ANYWAY = "Se déconnecter quand même"

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

    // AN-PARAMS: « Fermer » has ONE home (R206) - it dismisses the delete outcome dialog AND the two new
    // information sheets (« En savoir plus », the export chooser). DELETE_ACK points at it rather than repeating
    // the literal, so the duplication guard sees one string.
    const val CLOSE = "Fermer"
    const val DELETE_ACK = CLOSE

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

    // AN-LINKS. The row that opens the website's own « À propos » page (/a-propos). It sits below the other
    // legal rows and names the product so it is not confused with the section heading « À propos ».
    const val ABOUT_PAGE_ROW = "À propos de Mon Relevé"

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

    /**
     * R299: the fallback shown when no app can open a legal link (a device with no browser). It names the
     * address so the person can open it another way, rather than meeting a crash. A fun because the address is
     * live data (R181), not a constant.
     */
    fun legalNoHandler(url: String): String =
        "Aucune application ne peut ouvrir ce lien. " +
            "Vous pouvez le consulter à l’adresse : $url"
}
