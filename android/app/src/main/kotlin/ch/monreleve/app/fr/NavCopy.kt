package ch.monreleve.app.fr

// AN10. The bottom navigation labels (SPEC 11: four destinations - Aujourd'hui, Calendrier, Releve,
// Parametres). ONLY the LIVE destinations are named here: rendering a tab for a screen that does not
// exist is the dead-link defect R85 describes (the web nav linked two unbuilt routes for eleven tasks),
// so Releve and Parametres join this list when AN11 and AN12 build them, not before (R282: the product
// never advertises what it does not yet have). Fully accented, typographic apostrophe (R155 / R126).

object NavCopy {
    const val AUJOURDHUI = "Aujourd’hui"
    const val CALENDRIER = "Calendrier"

    // AN11: the Releve tab and its screen land together (R282 - the tab is advertised the moment its screen
    // exists, not before). Parametres joins in AN12.
    const val RELEVE = "Relevé"
}
