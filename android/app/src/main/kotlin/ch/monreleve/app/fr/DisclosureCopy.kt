package ch.monreleve.app.fr

// AN-AUTO increment 3b (R316 / D5 / SPEC 11.1 "Avant l'autorisation"). The prominent disclosure shown BEFORE
// the system permission prompt. Fully accented (R155), typographic apostrophes (R126 / U+2019). Reachable from
// ui/screens/disclosure/DisclosureScreen.kt (R238).
//
// IT DOES NOT COPY GOOGLE'S "collecte" TEMPLATE. Google's template says the app "collects location data"; Mon
// Releve does NOT collect (transmit) a coordinate - it determines the country ON THE PHONE and discards the fix
// (D18). Saying "collecte" would claim more than the record supports ("never claim more than the record
// supports"). So the disclosure states the background USE plainly (Play's expectation) and, equally plainly,
// that nothing but one conclusion per day is kept (docs/play-background-location.md).
//
// D19 - MANUAL IS A PEER. The two choices are equally weighted: "Autoriser la localisation" and "Rester en
// saisie manuelle". Nothing here suggests manual is lesser.

object DisclosureCopy {
    const val TITLE = "Avant d’activer la détection automatique"

    // Play's background-use expectation, stated plainly: the phone's location, in the background, during working
    // hours, even when the app is closed.
    const val USES_LOCATION =
        "Pour vous proposer vos journées, l’application utilise la localisation de votre téléphone pendant vos " +
            "heures de travail, en arrière-plan, même lorsque l’application est fermée."

    // The privacy promise (D18): determined on-device, position discarded. No coordinate, route, address or history.
    const val ON_DEVICE =
        "Votre position est analysée uniquement sur votre téléphone pour déterminer si la journée s’est passée " +
            "en Suisse ou à domicile, puis elle est aussitôt effacée."

    const val WHAT_IS_KEPT =
        "L’application ne conserve qu’une conclusion par jour : ni trajet, ni adresse, ni historique de vos " +
            "déplacements."

    const val NEVER_SHARED =
        "Rien n’est transmis : votre position n’est jamais partagée avec votre employeur ni avec l’administration."

    // SPEC 11.1: warn in advance that Android 10+ asks TWICE (in-use, then background) - the unexplained second
    // dialog is the main reason background grants get refused.
    const val ANDROID_TEN_WARNING =
        "Sur Android 10 et versions ultérieures, le système pose la question en deux fois : d’abord pendant que " +
            "vous utilisez l’application, puis pour l’arrière-plan. Acceptez les deux pour que la détection " +
            "fonctionne."

    // The two equally-weighted choices (D19).
    const val ALLOW = "Autoriser la localisation"
    const val STAY_MANUAL = "Rester en saisie manuelle"

    // R316: raised by the composition root (a Toast) when the person revokes the permission in system settings -
    // the app falls back to manual, plainly, without nagging. Reached from MainActivity, not a surface.
    const val PERMISSION_REVOKED =
        "Détection automatique désactivée : l’autorisation de localisation a été retirée. Vous pouvez saisir " +
            "vos journées manuellement."
}
