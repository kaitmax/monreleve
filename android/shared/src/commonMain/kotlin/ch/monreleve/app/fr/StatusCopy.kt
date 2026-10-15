package ch.monreleve.app.fr

// AN3 increment 2. French copy for the four badge states (SPEC 6.2), ported
// from web/lib/fr/statuses.ts. Every user-facing string lives in fr/;
// design/ZoneTokens.kt references this and adds only the presentation
// metadata - icon and colour.
//
// Keyed by a plain String, not by design.Status: fr/ carries no runtime
// imports (matching the web side's lib/fr, and SPEC 5's dependency
// direction - ui/core depends on fr/, never the reverse). See Zones.kt's
// own header for the full reasoning and the one place this weakens a
// static guarantee the TS reference had for free.
//
// NO THRESHOLD NUMBERS. None of these explanations names 40% or 49,9% -
// the thresholds come from the year's RuleSet (SPEC 7.7), and a number
// written into copy is a second source of truth that goes stale silently.
//
// VOCABULARY. Declare, enregistre, horodate - never certifie, atteste or
// conforme (SPEC section 20). These sentences describe a position, never
// a guarantee.

data class StatusCopy(val label: String, val explanation: String)

/**
 * U+00A0 NO-BREAK SPACE, before a colon - French typography (ruling R91):
 * a colon must never start a new line, so the space before it does not
 * break. Built from its hex codepoint rather than typed or escaped - see
 * fr/format/Numbers.kt's own header for why. Found missing here by diffing
 * this file's own bytes against web/lib/fr/statuses.ts byte for byte
 * (R181: derive, do not retype), not assumed correct because the visible
 * text looked identical.
 */
private val NBSP_BEFORE_COLON: Char = 0x00A0.toChar()

/**
 * U+2019 RIGHT SINGLE QUOTATION MARK - the typographic apostrophe French
 * elision uses ("s'applique"), not the ASCII straight quote. Found the
 * same way as NBSP_BEFORE_COLON: this file's bytes diverged from
 * web/lib/fr/statuses.ts's at exactly this one character, and nowhere
 * else in the file's actual copy values.
 */
private val APOSTROPHE: Char = 0x2019.toChar()

val STATUS_COPY: Map<String, StatusCopy> =
    mapOf(
        "compliant" to
            StatusCopy(
                // RULING R41. "Dans les limites" described staying under a
                // boundary and named neither consequence; the other three
                // labels each state one. "Sous les deux seuils" makes the
                // compliant state parallel to them: under BOTH.
                label = "Sous les deux seuils",
                explanation = "Votre taux de télétravail déclarable reste sous le plafond fiscal.",
            ),
        "mission-exposure" to
            StatusCopy(
                label = "Missions exposées",
                explanation =
                    "Une partie de vos jours de mission dépasse le plafond et reste imposable en France.",
            ),
        "regime-lost" to
            StatusCopy(
                label = "Régime non applicable",
                explanation =
                    "Le télétravail seul dépasse le plafond fiscal$NBSP_BEFORE_COLON: le régime " +
                        "frontalier ne s${APOSTROPHE}applique plus.",
            ),
        "social-switch" to
            StatusCopy(
                label = "Bascule de sécurité sociale",
                explanation =
                    "Le seuil de sécurité sociale est dépassé$NBSP_BEFORE_COLON: votre affiliation " +
                        "peut basculer en France.",
            ),
    )
