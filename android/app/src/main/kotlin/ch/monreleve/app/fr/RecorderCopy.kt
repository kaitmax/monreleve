package ch.monreleve.app.fr

// AN5 increment 5. Labels for the dev recorder (dev/DevRecorderActivity), the
// throwaway instrument that records a day and shows its sync state so the AN5
// walkthrough can drive a real write. The production Aujourd'hui screen is AN8/AN9;
// this is a developer tool, never a SPEC 11 screen, the same status as the gallery
// and the sign-in probe - but still French from fr/ (R155) and reachable (R238).
//
// PENDING IS SHOWN IN WORDS, PERSISTENTLY (DESIGN-SYSTEM section 2): "En attente de
// synchronisation" is a row state that stays on screen until sync clears it, never
// a toast that flashes and is gone.
//
// No colon or apostrophe in any value here, so none needs the NBSP/typographic
// codepoints StatusCopy.kt documents; every accent is a literal UTF-8 character,
// the convention the rest of fr/ follows (ProbeCopy.kt, SignInCopy.kt).

object RecorderCopy {
    const val TITLE = "Enregistreur (dev)"
    const val RECORD_HOME = "Enregistrer Domicile"
    const val RECORD_CH = "Enregistrer Suisse"
    const val EARLIER = "Jour précédent"
    const val LATER = "Jour suivant"
    const val SYNC = "Synchroniser"

    // The pending-sync line is a production concept now (AN5b's Aujourd'hui shows it too), so its one
    // home is AujourdhuiCopy.PENDING and this dev tool references it - R206, rather than a second copy
    // the duplication guard rightly refused.
    const val STATE_PENDING = AujourdhuiCopy.PENDING
    const val STATE_SYNCED = "Synchronisé"
    const val STATE_FAILED = "Échec"
    const val EMPTY = "Aucune journée enregistrée"
}
