package ch.monreleve.app.fr

// AN3 increment 4. No direct web component exists to port (detection is
// AN6+ scope); built from SPEC line 839's own two phrases: "the confidence
// tier in words (« Detection fiable » / « Detection incertaine -
// verifiez »)". LOW is realistic, non-final French (TODO-COPY convention,
// per tasks/plan.md's UI Discipline) since SPEC names only the two states
// that reach a proposal card - a LOW-tier day never produces one (SPEC
// 839), but the type still needs a third word for a tier that exists in
// the data model (D25) even when no card ever shows it.
//
// RULING R27: words, never a percentage. A confidence tier is a
// judgement about evidence quality, not a statistic - showing "82%"
// invites a false precision the detection method does not have.

object ConfidenceCopy {
    const val HIGH = "Détection fiable"
    const val MEDIUM = "Détection incertaine"
    const val LOW = "Détection peu fiable"
}
