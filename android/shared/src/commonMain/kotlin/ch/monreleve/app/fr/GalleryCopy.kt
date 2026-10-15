package ch.monreleve.app.fr

// AN3 increment 6. Captions for the AC3 instrument screen
// (ch.monreleve.app.dev.GalleryScreen) - a developer-only surface, never
// a SPEC 11 screen, but still French and still sourced from fr/ (R155):
// the whole point of looking at this screen is that it renders the same
// way a real one eventually will, in the same language discipline.

object GalleryCopy {
    const val TITLE = "Galerie des composants"

    const val SECTION_RAIL = "Repère de seuil"
    const val SECTION_BADGE = "Badge de zone"
    const val SECTION_RATE = "Affichage du taux"
    const val SECTION_TILE = "Vignette de jours"
    const val SECTION_DAY_CELL = "Cellules de jour"
    const val SECTION_CONFIDENCE = "Fiabilité de la détection"
    const val SECTION_FORMATTERS = "Formateurs"

    const val RAIL_INLINE_COMPLIANT = "En ligne, conforme, 30 %"
    const val RAIL_INLINE_FISCAL_EXPOSURE = "En ligne, dépassement fiscal, 45 %"
    const val RAIL_INLINE_SOCIAL_SWITCH = "En ligne, bascule sociale, 55 %"
    const val RAIL_COMPACT_320 = "Compact, cas Genève à 39,16 %"
    const val RAIL_SOCIAL = "Variante sociale, générique"
    // No RAIL_UNAVAILABLE here: fr/rail/RailCopy.kt already carries
    // "Taux indisponible" as RAIL_UNAVAILABLE_LABEL - CopyDuplicationTest
    // found the two-name duplicate on this file's first real run, and the
    // fix is to reference that one, not to keep a second copy in step.

    const val BADGE_COMPLIANT = "Statut conforme"
    const val BADGE_MISSION_EXPOSURE = "Statut missions exposées"
    const val BADGE_REGIME_LOST = "Statut régime perdu"
    const val BADGE_SOCIAL_SWITCH = "Statut bascule sociale"

    const val RATE_CONVERGING = "Taux déclaré seul"
    const val RATE_DIVERGING = "Taux déclaré et taux brut"

    const val TILE_POSITIVE = "Jours restants, positif"
    const val TILE_NEGATIVE = "Jours restants, dépassement"

    const val CONFIDENCE_LOW = "Fiabilité faible"
    const val CONFIDENCE_MEDIUM = "Fiabilité moyenne"
    const val CONFIDENCE_HIGH = "Fiabilité élevée"
}
