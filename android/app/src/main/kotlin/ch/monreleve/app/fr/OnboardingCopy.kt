package ch.monreleve.app.fr

// AN-ONBOARD. The onboarding WIZARD (design/onboarding steps 1-7 + "Tout est prêt"), replacing AN5b's single
// form. Fully accented (R155), typographic apostrophes (R126 / U+2019). Reachable from the onboarding screens
// (R238). Copy word for word from the approved mockups; figures that NAME the method (240 jours) are the
// method's own label, not a threshold (R153 governs thresholds, which this never prints).

object OnboardingCopy {
    /** "Étape N sur 7" - built here, not in a composable (fence 4). */
    fun stepLabel(step: Int): String = "Étape $step sur 7"

    const val CONTINUE = "Continuer"
    // "Retour" has one home: LicencesCopy.BACK (R206); the wizard references that.

    // ---- Labels SHARED with the Paramètres screen, which edits the same settings (R206: one home). The
    // wizard uses some of these too; the wizard-specific titles are below.
    const val CANTON_LABEL = "Canton de travail"
    const val CANTON_PLACEHOLDER = "Choisissez un canton"
    const val RATE_LABEL = "Taux d’activité (%)"
    const val RATE_HINT = "Votre pourcentage d’activité, tel qu’il figure sur votre contrat."
    const val METHOD_LABEL = "Méthode de décompte"
    const val METHOD_SIMPLIFIED = "Forfait de 240 jours"
    const val METHOD_EXACT = "Nombre de jours réel"
    const val METHOD_HELPER =
        "Le forfait de 240 jours est la méthode simplifiée. Choisissez le nombre réel seulement si " +
            "votre employeur applique un décompte exact et uniforme."
    const val GRANULARITY_LABEL = "Décompte des journées"
    const val GRANULARITY_DAY = "Journées entières"
    const val GRANULARITY_HALF_DAY = "Demi-journées"
    const val START_DATE_LABEL = "Début d’activité (facultatif)"

    // Step 1 - Votre nom.
    const val NAME_TITLE = "Votre nom"
    const val NAME_SUBTITLE = "Tel qu’il figurera sur votre relevé, comme sur vos documents officiels."
    const val NAME_LABEL = "Prénom et nom"
    const val NAME_PREVIEW_TITLE = "Aperçu de votre relevé"
    const val TITULAIRE = "Titulaire"

    // Step 2 - Canton de votre employeur.
    const val CANTON_TITLE = "Canton de votre employeur"
    const val CANTON_SEARCH = "Rechercher un canton"
    const val CANTON_INFO = "Le régime fiscal applicable dépend du canton de votre employeur."
    const val CANTON_CONSEQUENCE_SOURCE =
        "Imposition à la source : au-delà du plafond, les jours concernés deviennent imposables en France."
    const val CANTON_CONSEQUENCE_RESIDENCE =
        "Ce canton applique l’accord de 1983 : au-delà du plafond, c’est le statut de frontalier lui-même " +
            "qui est en jeu."
    const val CANTON_LIST_PROVISIONAL =
        "La liste des cantons concernés par l’accord de 1983 est en cours de vérification."

    // Step 3 - Votre taux d'activité.
    const val RATE_TITLE = "Votre taux d’activité"
    const val RATE_SUBTITLE = "Tel qu’il figure sur votre contrat."
    const val RATE_100 = "100 %"
    const val RATE_80 = "80 %"
    const val RATE_60 = "60 %"
    const val RATE_OTHER = "Autre"
    const val RATE_OTHER_LABEL = "Votre taux d’activité (%)"
    const val RATE_INFO = "Il sert à calculer le nombre de jours de travail de votre année."

    // Step 4 - Méthode de décompte. The title reuses METHOD_LABEL and the real-days choice reuses METHOD_EXACT
    // (above, shared with Paramètres) - R206, one home. Only the simplified title and the descriptions are new.
    const val METHOD_SUBTITLE = "Choisissez celle qu’applique votre employeur."
    const val METHOD_SIMPLIFIED_TITLE = "Méthode simplifiée"
    const val METHOD_SIMPLIFIED_DESC = "Un forfait de 240 jours de travail par an, ajusté à votre taux d’activité."
    const val METHOD_EXACT_DESC = "Si votre employeur décompte précisément vos jours travaillés."
    const val METHOD_INFO = "En cas de doute, demandez à votre service des ressources humaines."
    const val EXACT_TOTAL_LABEL = "Nombre total de jours travaillés dans l’année"

    // Step 5 - Toute l'année ?
    const val PERIOD_TITLE = "Avez-vous travaillé toute l’année chez cet employeur ?"
    const val PERIOD_ALL_TITLE = "Oui, depuis le 1ᵉʳ janvier"
    const val PERIOD_ALL_DESC = "Votre relevé couvrira l’année entière."
    const val PERIOD_PART_TITLE = "Non, j’ai commencé en cours d’année"
    const val PERIOD_PART_DESC = "Votre relevé couvrira la période à partir de votre arrivée."
    const val PERIOD_START_LABEL = "Date de début"

    // Step 6 - Comment enregistrer vos journées ?
    const val MODE_TITLE = "Comment enregistrer vos journées ?"
    const val MODE_MANUAL_TITLE = "Manuellement"
    const val MODE_MANUAL_DESC = "Chaque jour, vous indiquez où vous avez travaillé. Un geste suffit."
    const val MODE_AUTO_TITLE = "Automatiquement"
    const val MODE_AUTO_BADGE = "Bêta"
    const val MODE_AUTO_DESC =
        "Votre téléphone vérifie votre position quatre fois par jour et vous propose votre journée. " +
            "Rien n’est enregistré sans votre accord."
    const val MODE_INFO = "Les deux produisent exactement le même relevé. Vous pourrez changer à tout moment."

    // Step 7 - Un rappel le soir ?
    const val REMINDER_TITLE = "Un rappel le soir ?"
    const val REMINDER_SUBTITLE =
        "Une seule notification par jour ouvré, uniquement si votre journée n’est pas encore enregistrée."
    const val REMINDER_LOCK_INFO = "Sur l’écran verrouillé, la notification n’indique jamais où vous étiez."
    const val REMINDER_YES = "Oui, me le rappeler"
    const val REMINDER_NOT_NOW = "Pas maintenant"

    // Tout est prêt.
    const val READY_TITLE = "Tout est prêt"
    const val READY_SUBTITLE = "Voici comment votre relevé vous identifiera."

    // The titulaire row reuses TITULAIRE and the real-days value reuses METHOD_EXACT (R206, one home).
    const val READY_ROW_CANTON = "Canton de l’employeur"
    const val READY_ROW_METHOD = "Méthode"
    const val READY_ROW_PERIOD = "Période"
    const val READY_METHOD_SIMPLIFIED = "Simplifiée, 240 jours"
    const val READY_PERIOD_ALL = "Année entière"
    const val READY_NOTE =
        "Votre taux à déclarer apparaîtra dès votre premier jour enregistré. Vous pourrez modifier ces " +
            "informations dans Paramètres."

    // Field + save errors (R282: honest, naming no feature the product lacks).
    const val ERROR_NAME_MISSING = "Indiquez le nom qui figurera sur votre relevé."
    const val ERROR_CANTON_MISSING = "Choisissez le canton de votre employeur."
    const val ERROR_RATE_INVALID = "Le taux d’activité n’est pas valide."
    const val ERROR_EXACT_TOTAL_MISSING = "Indiquez le nombre total de jours travaillés."
    const val ERROR_EXACT_TOTAL_INVALID = "Le nombre total de jours travaillés n’est pas valide."
    const val ERROR_START_DATE_INVALID = "La date de début n’est pas valide."
    const val ERROR_PERIOD_INVALID = "La date de début ne tombe pas dans l’année de calcul."
    const val ERROR_SAVE_REFUSED = "Ces paramètres n’ont pas pu être enregistrés. Vérifiez vos saisies."
    const val ERROR_NETWORK = "Enregistrement impossible. Vérifiez votre connexion, puis réessayez."
    const val ERROR_SESSION_ENDED = "Votre session a expiré. Reconnectez-vous, puis réessayez."
}
