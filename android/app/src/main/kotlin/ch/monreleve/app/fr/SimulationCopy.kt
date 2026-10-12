package ch.monreleve.app.fr

// AN-SIM. The simulator screen's copy, word for word from design/decide/Simulation.dc.html. Fully accented
// (R155), typographic apostrophes U+2019 (R126). Every public member is referenced from ui/screens/simulation
// (R238). The tile labels (« jours de marge avant 40 % », « jours au-dessus de 40 % », « jours avant 49,9 % »)
// are NOT retyped here: they have one home in PrevisionCopy and the simulator reuses them (R206), so the two
// forecast screens name a threshold the same way.
//
// R153/R181 - NAME THE RULE, DO NOT TYPE ITS VALUE. The consequence sentence takes an already-formatted
// percentage (formatPercent of the RuleSet fiscal ceiling); « 40 % » is never typed. CONSEQUENCE_FISCAL is the
// only consequence sentence shown: docs/regulatory-sources.md carries the verified fiscal row (entry 1, source
// AFC Genève / REG-UPDATE); it carries no sentence-level social-threshold consequence, so none is written here
// (R146 - a consequence is shown only when a verified row says it).

object SimulationCopy {
    /** The top-bar section name (the design's own header). */
    const val NAV_TITLE = "Simulation"

    const val TITLE = "Et si… ?"

    // The four scenario chips. The rate chip is « Un autre taux » rather than the design's sample « Passer à
    // 80 % » - every figure in the design is sample data (README), and the scenario is "a different employment
    // rate", chosen on the screen, not a fixed 80 %.
    const val SCENARIO_EXTRA_WEEKDAY = "Un jour de plus à domicile"
    const val SCENARIO_EXTRA_DAYS = "Des jours en plus ce mois-ci"
    const val SCENARIO_RATE = "Un autre taux"
    const val SCENARIO_MISSIONS = "Des missions"

    /** The per-scenario input labels. */
    const val WEEKDAY_LABEL = "Quel jour en plus ?"
    const val EXTRA_DAYS_LABEL = "Combien de jours en plus ce mois-ci ?"
    const val RATE_LABEL = "Nouveau taux d’activité"
    const val MISSIONS_FRANCE_LABEL = "Missions en France"
    const val MISSIONS_THIRD_LABEL = "Missions dans un autre État"

    /** The two compared figures. */
    const val CURRENT_FIGURE = "Votre projection"
    const val CHANGE_FIGURE = "Avec ce changement"

    /** The fiscal consequence; [threshold] is an already-formatted percentage (R181). Source stated separately. */
    fun consequenceFiscal(threshold: String): String =
        "Au-delà de $threshold, vos jours de télétravail " +
            "deviennent imposables en France."

    const val CONSEQUENCE_SOURCE = "Source : AFC Genève."

    /** Always on the screen: the cases the model does not cover never produce a confident number (AN-SIM §1). */
    const val NOT_COVERED =
        "Ce simulateur ne couvre pas le télétravail depuis un autre pays que la France, " +
            "un second employeur ni un changement de résidence en cours d’année."

    /** The buttons. « Revenir à ma prévision » is always shown; the others are per-scenario. */
    const val RETURN = "Revenir à ma prévision"
    const val ADOPT = "Adopter ce rythme"
    const val CHANGE_RATE = "Modifier mon taux dans les Paramètres"
}
