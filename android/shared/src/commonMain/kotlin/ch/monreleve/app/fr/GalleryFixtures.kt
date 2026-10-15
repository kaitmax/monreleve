package ch.monreleve.app.fr

// AN3 increment 6. Not copy - these are example INPUT values the
// gallery's formatter section needs (an ISO calendar day, an ISO
// instant), never rendered as-is. They live in fr/ anyway because
// FencesTest.kt's no-inline-string fence was deliberately hardened
// against a literal hoisted to a same-file constant inside dev/ or ui/
// (see that fence's own header) - a fixture value dev/GalleryScreen.kt
// needs has to come from outside dev/ and ui/ exactly as real copy does,
// and fr/ is the one place both fences exempt.
//
// BOTH VALUES ARE SPEC 6.4's OWN WORKED EXAMPLE, not invented here:
// DatesTest.kt's JUNE_EVENING fixture is "2027-06-18T16:03:00Z", which
// formatDateTime renders as "18.06.2027 a 18:03" (Europe/Paris, CEST,
// UTC+2) - confirmed by reading that test rather than picking a new
// date and hoping it parses.

object GalleryFixtures {
    /** The date half of DatesTest.kt's JUNE_EVENING, in formatDate's ISO YYYY-MM-DD form. */
    const val EXAMPLE_DATE = "2027-06-18"

    /** DatesTest.kt's own JUNE_EVENING - Instant.parse's ISO-8601 form, for formatDateTime. */
    const val EXAMPLE_INSTANT = "2027-06-18T16:03:00Z"
}
