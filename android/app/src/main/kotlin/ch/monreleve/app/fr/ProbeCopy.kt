package ch.monreleve.app.fr

// AN4 increment 6. Labels for the AC1 walkthrough probe (dev/SignInProbeActivity),
// which drives the SessionManager against pnpm dev after sign-in and shows each
// step's outcome. A developer-only instrument, never a SPEC 11 screen, but still
// French from fr/ (R155) and reachable (R238), the same discipline as GalleryCopy.

object ProbeCopy {
    const val TITLE = "Parcours de session (dev)"

    const val STEP_AUTHED = "Appel authentifié"
    const val STEP_REFRESH = "Rafraîchissement du jeton"
    const val STEP_AUTHED_AFTER = "Appel authentifié, jeton rafraîchi"
    const val STEP_SIGN_OUT = "Déconnexion"
    const val STEP_REFUSED = "Appel authentifié après déconnexion"

    const val OUTCOME_OK = "réussi"
    const val OUTCOME_REFRESHED = "jeton rafraîchi"
    const val OUTCOME_DONE = "effectuée"
    const val OUTCOME_REFUSED = "refusé, aucune session"
    const val OUTCOME_EXPIRED = "session expirée"
    const val OUTCOME_ENDED = "session fermée"
    const val OUTCOME_NETWORK = "connexion impossible"
}
