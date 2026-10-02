package ch.monreleve.app.fr

// AN-AUTO. The automatic-detection copy (SPEC 11.2 auto states, R311-R315). Fully accented (R155),
// typographic apostrophes (R126 / U+2019). Reachable from the Aujourd'hui auto surface (R238); until
// that surface is built (increment 5, R314) the strings are declared in CopyReachabilityTest's
// allowlist with the increment they wait for.
//
// R27: WORDS, NEVER A PERCENTAGE. A confidence judgement is about evidence quality, not a statistic;
// the not-sure message explains and directs, it never quotes a number.

object DetectionCopy {
    // The mode strip label when automatic detection is on (SPEC 11.2). No "Changer" link: the mode chooser
    // lives in Parametres, reachable from the bottom navigation (R282's reasoning - no link to a chooser the
    // screen does not host).
    const val MODE_AUTO = "Détection automatique (bêta)"

    // SPEC 11.2 ETAT A - the working day is not over; nothing to propose yet. A background fact, calm, no
    // spinner (the screen renders no progress animation).
    const val DETECTING_TITLE = "Détection en cours. Votre journée vous sera proposée ce soir."
    const val DETECTING_SUBTITLE = "Vous pourrez la confirmer ou la corriger."
    const val ENTER_NOW = "Saisir maintenant"

    // SPEC 11.2 ETAT B - the proposal. R314: phrased as a PROPOSAL to verify, never "vous étiez en Suisse".
    const val PROPOSAL_HEADING = "Journée détectée"
    const val PROPOSAL_TITLE = "Proposition — vérifiez"

    // Reached through proposalExplain(kindName), not directly - so private, like ReleveCopy's provenance words
    // and AujourdhuiCopy's internal fragments (the reachability census checks the public entry, not every part).
    private const val PROPOSAL_EXPLAIN_SUISSE = "Vous avez passé vos heures de travail en Suisse."
    private const val PROPOSAL_EXPLAIN_DOMICILE = "Vous êtes resté en France pendant vos heures de travail."

    // D18: the app keeps no fix times (no movement timeline), so the note names WHEN detection ran in words,
    // never a fabricated time range. "Sur cet appareil" is the privacy promise the disclosure made, kept here.
    const val PROPOSAL_DETECTED_NOTE = "Détecté aujourd’hui sur cet appareil, sans enregistrer vos déplacements."
    const val CONFIRM = "Confirmer"
    const val CORRECT = "Corriger"

    // The promise the product keeps (D16): nothing is recorded until the person confirms. Given room, not fine print.
    const val NOTHING_RECORDED_YET = "Rien n’est enregistré tant que vous n’avez pas confirmé."

    // SPEC 11.2 ETAT C - the provenance line on a recorded detected day. It appears wherever the entry is shown,
    // including the annual document (ReleveCopy carries its own « Détection confirmée / corrigée »). R314: an
    // accountant can see the day came from detection. Never abbreviated to an icon.
    // Reached through provenanceLine(provenanceName), not directly - so private (the ReleveCopy pattern).
    private const val PROVENANCE_CONFIRMED = "Détecté automatiquement, confirmé par vous."
    private const val PROVENANCE_CORRECTED = "Détecté automatiquement, corrigé par vous."

    // R312: shown when a day withholds (MEDIUM or LOW under R311). It says why, in plain words, and what
    // to do - and it is NOT alarming: the honest answer is "we are not sure", not "something is wrong".
    const val NOT_SURE = "Nous ne sommes pas certains de votre position ce jour-là. Indiquez-le vous-même."

    // R313: shown ONCE when the person's recent days are mostly near the border, where detection is unreliable.
    // It offers manual as the more accurate choice without disparaging detection, and leaves the choice to them
    // (D19 - manual is a peer, auto is never forced off). No percentage (R27).
    const val NEAR_BORDER =
        "Vous semblez habiter près de la frontière, là où la détection est souvent incertaine. La saisie " +
            "manuelle y sera plus fiable. Vous pouvez garder la détection automatique ou passer en saisie " +
            "manuelle, comme vous préférez."

    /**
     * The one-line explanation under a proposal, by the proposed RecordedKind's `.name` (the DayCellCopy
     * pattern - fr/ needs no import of the ui vocabulary). A proposal is only ever En Suisse or Domicile.
     */
    fun proposalExplain(kindName: String): String =
        when (kindName) {
            "SUISSE" -> PROPOSAL_EXPLAIN_SUISSE
            else -> PROPOSAL_EXPLAIN_DOMICILE
        }

    /**
     * The provenance line for a recorded detected day (ETAT C), by the RecordedProvenance's `.name`. Null for a
     * manual day - it carries no detection line. Mapped by name so fr/ needs no import of the ui vocabulary.
     */
    fun provenanceLine(provenanceName: String): String? =
        when (provenanceName) {
            "DETECTED_CONFIRMED" -> PROVENANCE_CONFIRMED
            "DETECTED_CORRECTED" -> PROVENANCE_CORRECTED
            else -> null
        }
}
