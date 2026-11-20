package ch.monreleve.app.fr

// AN-FORCE-UPDATE (R1112). The update screen (ui/screens/update/UpdateRequiredScreen.kt): a title, one sentence and one
// button, shown in place of the whole app when the server's minimum supported version is above this build's
// (docs/api-v1.md 15). Fully accented (R155), typographic apostrophe (R126 / U+2019). Written by the session and
// listed in REPORT-AN-FORCE-UPDATE QUESTIONS T1-T3 for the operator; they ship as written unless refused.
//
// NO VERSION NUMBER IN THE SENTENCE (R153): it names the situation, not a figure that would go stale. The product name
// is Fr.APP_NAME by reference (R206). It names Google Play because the button opens the Play listing, and this copy is
// shown only by the Android host: an iOS host, when one exists, needs its own sentence for its own store.

object UpdateCopy {
    const val TITLE = "Mise à jour nécessaire"
    const val BODY =
        "Cette version de ${Fr.APP_NAME} n’est plus prise en charge. " +
            "Installez la dernière version depuis Google Play pour continuer."
    const val BUTTON = "Mettre à jour"
}
