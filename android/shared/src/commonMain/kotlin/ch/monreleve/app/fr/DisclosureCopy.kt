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

    // R320: detection checks the position FOUR TIMES a working day, not all day - stated plainly so the person
    // knows exactly when their position is looked at, and that it is not checked at any other moment.
    const val FOUR_TIMES =
        "Elle vérifie votre position quatre fois au cours d’une journée de travail — vers 9 h 30, 11 h, 14 h 30 " +
            "et 16 h 30 — et à aucun autre moment."

    // The privacy promise (D18): determined on-device, position discarded. No coordinate, route, address or history.
    const val ON_DEVICE =
        "Votre position est analysée uniquement sur votre téléphone pour déterminer si la journée s’est passée " +
            "en Suisse ou à domicile, puis elle est aussitôt effacée."

    // AN-NEXT-2 / R325. THE DISCLOSURE SAYS WHAT IS TRUE. AN-NEXT added a NETWORK (Wi-Fi/cell) fallback for the
    // indoor telework days where GPS stays silent; with it, Android asks the system's location service to work out
    // the position from nearby Wi-Fi and cell networks. The application still stores and sends nothing - but the
    // phone does consult that service, so this says so plainly rather than implying the position never leaves the
    // device at all. Named « réseaux Wi-Fi et cellulaires », not Google, because the reader controls it through the
    // phone's own location settings, which is the actionable truth.
    const val NETWORK_LOCATION =
        "Pour déterminer votre position, Android peut utiliser les réseaux Wi-Fi et cellulaires à proximité, " +
            "selon les réglages de localisation de votre téléphone. L’application, elle, ne conserve ni " +
            "n’envoie jamais votre position."

    const val WHAT_IS_KEPT =
        "L’application ne conserve qu’une conclusion par jour : ni trajet, ni adresse, ni historique de vos " +
            "déplacements."

    // AN-COPY-TRUTH R1220 (A6 F5a). « Rien n’est transmis » was false: a day the person validates from a proposal IS
    // sent, and the Data safety form declares it as Approximate location, collected (Android Ruling 18 Q-DS1). The
    // sentence now says what leaves the phone and what never does. « validez » covers a confirmed AND a corrected
    // proposal (both are sent); « ce que la détection vous avait proposé » is detectedKind, which is always the
    // CH/HOME side (EntriesMapping.toEntryWrite) - the day itself may have been corrected to a mission or an absence,
    // so its kind is not enumerated. « Seule » is bounded by the screen it sits on: what detection produces.
    const val NEVER_SHARED =
        "Votre position n’est jamais transmise, ni à nous, ni à votre employeur, ni à l’administration. Seule la " +
            "journée que vous validez nous est envoyée, avec ce que la détection vous avait proposé : en Suisse ou " +
            "à domicile."

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
