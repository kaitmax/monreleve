package ch.monreleve.app.data.repo

/**
 * The only writer of entries (SPEC 5): ui/ writes through this, never through the
 * DAO or the API directly. A stub today - the rule exists before the thing it
 * governs (the fence in increment 3 is written now; Room and sync arrive at AN5).
 */
interface EntryRepository {
    /** Placeholder until entry writes land at AN5. */
    val ready: Boolean
}
