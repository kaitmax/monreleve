package ch.monreleve.app.fr

// AN5b increment 1. The manual-onboarding screen (SPEC 11.1 manual path). Fully accented (R155),
// typographic apostrophes (R126 / U+2019). Reachable from ui/screens/onboarding/OnboardingScreen.kt
// (R238).
//
// R282 - NOT MENTIONED HERE, ON PURPOSE: automatic mode, a mode chooser, reminders. The manual
// product is complete on its own and names nothing it does not have.
//
// R153 - the copy names the RULE, not a threshold value. The canton consequence describes what a
// breach means under each regime; it never prints 40 % or 49,9 %. The rate error says the taux is
// invalid without typing "1 a 100", the bound the engine owns.
//
// R125 / Checkpoint A row 7 - the 1983-accord distinction is STATED, its enumeration HEDGED: the
// per-canton line is derived from the engine's regimeFor (R181), and CANTON_LIST_PROVISIONAL says
// the membership is still being verified, worded as the web guide words it.

object OnboardingCopy {
    const val TITLE = "Vos paramètres de calcul"
    const val INTRO =
        "Ces informations servent à calculer votre part de télétravail. Vous pourrez les modifier " +
            "plus tard dans les paramètres."

    const val CANTON_LABEL = "Canton de travail"
    const val CANTON_PLACEHOLDER = "Choisissez un canton"
    const val CANTON_CONSEQUENCE_SOURCE =
        "Imposition à la source : au-delà du plafond, les jours concernés deviennent imposables en France."
    const val CANTON_CONSEQUENCE_RESIDENCE =
        "Ce canton applique l’accord de 1983 : au-delà du plafond, c’est le statut de frontalier lui-même " +
            "qui est en jeu."
    const val CANTON_LIST_PROVISIONAL =
        "La liste des cantons concernés par l’accord de 1983 est en cours de vérification."

    const val RATE_LABEL = "Taux d’activité (%)"
    const val RATE_HINT = "Votre pourcentage d’activité, tel qu’il figure sur votre contrat."

    const val METHOD_LABEL = "Méthode de décompte"
    const val METHOD_SIMPLIFIED = "Forfait de 240 jours"
    const val METHOD_EXACT = "Nombre de jours réel"
    const val METHOD_HELPER =
        "Le forfait de 240 jours est la méthode simplifiée. Choisissez le nombre réel seulement si " +
            "votre employeur applique un décompte exact et uniforme."
    const val EXACT_TOTAL_LABEL = "Nombre total de jours travaillés dans l’année"

    const val GRANULARITY_LABEL = "Décompte des journées"
    const val GRANULARITY_DAY = "Journées entières"
    const val GRANULARITY_HALF_DAY = "Demi-journées"

    const val START_DATE_LABEL = "Début d’activité (facultatif)"
    const val START_DATE_HINT = "Format AAAA-MM-JJ. Laissez vide si vous avez travaillé toute l’année."

    const val SUBMIT = "Enregistrer et commencer"
    const val SUBMITTING = "Enregistrement…"

    // R282: honest failure copy, no feature it does not have.
    const val ERROR_CANTON_MISSING = "Choisissez votre canton de travail."
    const val ERROR_RATE_INVALID = "Le taux d’activité n’est pas valide."
    const val ERROR_EXACT_TOTAL_MISSING = "Indiquez le nombre total de jours travaillés."
    const val ERROR_EXACT_TOTAL_INVALID = "Le nombre total de jours travaillés n’est pas valide."
    const val ERROR_START_DATE_INVALID = "La date de début n’est pas valide (format AAAA-MM-JJ)."
    const val ERROR_PERIOD_INVALID = "La date de début ne tombe pas dans l’année de calcul."
    const val ERROR_SAVE_REFUSED = "Ces paramètres n’ont pas pu être enregistrés. Vérifiez vos saisies."

    const val ERROR_NETWORK = "Enregistrement impossible. Vérifiez votre connexion, puis réessayez."
    const val ERROR_SESSION_ENDED = "Votre session a expiré. Reconnectez-vous, puis réessayez."
}
