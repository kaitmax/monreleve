package ch.monreleve.app.fr

// AN12 increment 4 (R280). The licences screen's copy. R280 is DISCHARGED here: the simplified Swiss-border
// polygon ships in the APK today, so its ODbL attribution is shown now, not left to a future detection UI.
// The wording is taken from the notice that ships beside the data
// (android/app/src/main/assets/border/switzerland.json.LICENSE.txt) and docs/detection-model.md (R181 - the
// attribution is derived from the recorded source, never typed from memory).
//
// R282: the polygon is named as « données de frontière », never as a detection feature - the manual product
// mentions nothing it does not have. The forbidden-terms test (ParametresR282Test) scans this file too.

object LicencesCopy {
    const val TITLE = "Licences"
    const val BACK = "Retour"

    const val DATA_HEADING = "Données de frontière"

    /** ODbL 1.0 requires this exact credit wherever the data is used. Not translated - it is the attribution. */
    const val OSM_ATTRIBUTION = "© OpenStreetMap contributors"
    const val ODBL_BODY =
        "Cette application inclut un tracé simplifié de la frontière suisse, dérivé des données " +
            "d’OpenStreetMap (relation 51701). Ces données sont mises à disposition sous licence Open Data " +
            "Commons Open Database License (ODbL) 1.0, comme les données OpenStreetMap dont elles dérivent."
    const val ODBL_LINK = "https://opendatacommons.org/licenses/odbl/1-0/"

    // AN-FCM-CLIENT (R1150): Firebase Cloud Messaging and what it brings (Okio, javax.inject, Error Prone, Google Play
    // services) are named here because checkLicences derives the obligation from the release classpath (R298). The
    // Google Play services libraries are under the Android SDK licence, not Apache 2.0, and the copy says so.
    const val OSS_HEADING = "Logiciels libres"
    const val OSS_BODY =
        "Cette application est construite avec des composants libres, notamment Jetpack Compose, les " +
            "bibliothèques AndroidX (dont Room et WorkManager), le langage Kotlin et kotlinx.coroutines, " +
            "ainsi que Guava, Okio, javax.inject, les annotations JetBrains, Error Prone et JSpecify, et " +
            "Firebase Cloud Messaging, distribués sous licence Apache 2.0. Les services Google Play, dont " +
            "Firebase Cloud Messaging dépend, ne sont pas des logiciels libres : ils sont fournis sous les " +
            "conditions du kit de développement Android (Android Software Development Kit License)."
    const val APACHE_LINK = "https://www.apache.org/licenses/LICENSE-2.0"
}
