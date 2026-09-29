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
}
