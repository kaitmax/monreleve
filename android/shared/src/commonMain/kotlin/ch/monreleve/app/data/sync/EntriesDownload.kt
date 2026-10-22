package ch.monreleve.app.data.sync

import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.SyncState
import kotlinx.coroutines.flow.first

// AN-PULL (R481-R486). THE SERVER'S YEAR, BROUGHT DOWN TO THE PHONE.
//
// WHY. Nothing used to bring a year back. Someone who reinstalls, changes phone, or signs out and back in saw the
// Releve - read from the server, so correct - beside an EMPTY calendar and an empty Aujourd'hui (KMP-4's NOTICED 5:
// eleven rows on the server, none on the phone). They would reasonably believe their record was lost.
//
// WHERE IT LIVES (R482). Beside the sync engine, in commonMain, on what is already here: the session's GET (the
// seam DossierApi takes - SessionManager::authenticatedGet - so a 401 goes through KMP-3's refresh-once-and-replay
// like any call), the DAO, and the account provider, read when it is used (R303, AN-ACCOUNT-TAG). A server row
// becomes a local row through KMP-3's ONE mapping, ServerEntry.toSyncedEntity - the reconcile the drain already
// uses - so a downloaded row and a drained row cannot be built two ways. :app only triggers this.
//
// WHAT A DOWNLOAD IS NOT (R481, R486). It is not a record. A downloaded row is SYNCED, with the server's values
// exactly as returned - its id, its clientMutationId, its firstRecordedAt byte for byte. Nothing is queued, nothing
// is sent back, no mutation id is minted, and no event reaches the server's trail: the only request is a GET.
//
// THE RECONCILIATION (R483), keyed on (dayDate, portion) as 6.2 says - never on id:
//   - no local row                        -> the server's row, inserted SYNCED;
//   - a local row that is not SYNCED      -> KEPT, untouched. PENDING is the person's newer choice and will sync.
//                                            FAILED was sent and refused (R296): still the person's, never the
//                                            server's to overwrite - only a SYNCED row is (PARK-Y2);
//   - a SYNCED row equal to the server's  -> NO write at all (AN-CALENDAR: nothing changed, nothing written);
//   - a SYNCED row that differs           -> the server's row replaces it. The server is the record, and 6.4 says
//                                            the last write a phone sent is not necessarily the one kept;
//   - a SYNCED row the server lacks       -> NOT deleted. Entries have no DELETE, so this is an anomaly: kept,
//                                            COUNTED in the outcome for :app's log line, never shown as a problem;
//   - another account's or UNOWNED rows   -> never read, changed or shown: every read names the account (R303).
// FULL beside AM/PM for one day (a granularity change; 6.2 allows it) is stored as the server holds it - the key
// is (dayDate, portion) - and how it is displayed stays AN-CALENDAR's rule.
//
// A YEAR ARRIVES WHOLE OR NOT AT ALL (R484). Everything is parsed and checked BEFORE the first write: a refusal
// envelope (read_failed), a body for another year, a row outside the year, a repeated (dayDate, portion), an
// unknown kind (6.5: never guessed into a known one) - each is Failed, with the store untouched. The writes for one
// year then happen inside ONE transaction, supplied by the platform ([inTransaction]: Room's withTransaction on
// Android), so a write that fails part-way is rolled back and propagates as the exception it is. The decision for
// each row is made INSIDE that transaction, against the row as it stands then, so a tap that lands while the GET is
// in flight is kept rather than overwritten by a decision taken on a stale read.
//
// THE ACCOUNT IS READ TWICE. Once before the GET, to know whose year this is; again inside the transaction. If the
// phone has been signed out, or signed in as somebody else, while the year was in flight, nothing is written: the
// rows would otherwise land under the wrong tag, or under one that has just been cleared (R303). That ends quietly,
// as Unauthenticated - the person did nothing wrong and there is nothing to retry.

/** The outcome of bringing one tax year down from the server. */
sealed interface YearDownload {
    val year: Int

    /**
     * The year arrived whole and was applied in ONE transaction. [absentFromServer] counts the account's SYNCED rows
     * of the year that the server does not hold - R483's anomaly, kept on the phone and logged by the caller.
     */
    data class Applied(
        override val year: Int,
        val inserted: Int,
        val replaced: Int,
        val unchanged: Int,
        val keptUnsynced: Int,
        val absentFromServer: Int,
    ) : YearDownload

    /**
     * Nothing changed: the server could not be reached, refused, or answered with something that is not this whole
     * year. The person is told, with a retry (R484).
     */
    data class Failed(override val year: Int) : YearDownload

    /**
     * No usable session, or the account changed while the year was in flight. Nothing changed, and it ends quietly,
     * as sign-out would (R484): a sign-in brings the year down again.
     */
    data class Unauthenticated(override val year: Int) : YearDownload
}

class EntriesDownload(
    private val dao: EntryDao,
    /** An authenticated GET - SessionManager::authenticatedGet, the seam DossierApi takes (R210 refresh included). */
    private val get: suspend (String) -> AuthedOutcome,
    /** The signed-in account's tag, read when it is used (R303, R423) - never captured at construction. */
    private val currentAccount: () -> String?,
    /** Runs [block] as ONE transaction (R484). Android passes Room's withTransaction; a test, an in-memory one. */
    private val inTransaction: suspend (block: suspend () -> Unit) -> Unit,
) {
    /**
     * R481: GET one tax year and apply it (R483) as one transaction (R484). A write that fails inside the
     * transaction is rolled back and rethrown; every other failure is [YearDownload.Failed] with nothing changed.
     */
    suspend fun download(year: Int): YearDownload {
        val account = currentAccount() ?: return YearDownload.Unauthenticated(year)
        return when (val fetched = fetch(year, account)) {
            is Fetched.Rows -> applyYear(year, account, fetched.rows)
            Fetched.NotTheYear -> YearDownload.Failed(year)
            Fetched.SessionGone -> YearDownload.Unauthenticated(year)
        }
    }

    /**
     * R481: each of [years] in turn. A session that is gone stops the run - the next year would only meet the same
     * answer - so the list then ends with that year's [YearDownload.Unauthenticated].
     */
    suspend fun downloadYears(years: List<Int>): List<YearDownload> {
        val outcomes = mutableListOf<YearDownload>()
        for (year in years) {
            val outcome = download(year)
            outcomes += outcome
            if (outcome is YearDownload.Unauthenticated) break
        }
        return outcomes
    }

    /**
     * R485's start check: of [years], those in which the signed-in account holds NO row on this phone. One read of
     * the account's rows (a SELECT on the leading column of the entry table's primary key), no network. No account
     * means nothing is anybody's to fetch (R303: fail closed).
     */
    suspend fun emptyLocally(years: List<Int>): List<Int> {
        val account = currentAccount() ?: return emptyList()
        val rows = dao.observeAllForAccount(account).first()
        return years.filter { year -> rows.none { it.inYear(year) } }
    }

    private suspend fun fetch(
        year: Int,
        account: String,
    ): Fetched =
        when (val outcome = get(entriesYearPath(year))) {
            is AuthedOutcome.Ok -> wholeYearOf(outcome.body, year, account)?.let(Fetched::Rows) ?: Fetched.NotTheYear
            AuthedOutcome.NetworkError -> Fetched.NotTheYear
            AuthedOutcome.SessionExpired,
            AuthedOutcome.SessionEnded,
            AuthedOutcome.NoSession,
            -> Fetched.SessionGone
        }

    private suspend fun applyYear(
        year: Int,
        account: String,
        incoming: List<EntryEntity>,
    ): YearDownload {
        var applied: Tally? = null
        inTransaction {
            // The account again, inside the transaction: a year fetched for one account is never written under
            // another, nor after its account has gone.
            if (currentAccount() == account) applied = apply(account, incoming)
        }
        val tally = applied ?: return YearDownload.Unauthenticated(year)
        val served = incoming.mapTo(HashSet()) { it.dayDate to it.portion }
        val absent =
            dao.observeAllForAccount(account).first().count {
                it.inYear(year) && it.syncState == SyncState.SYNCED && (it.dayDate to it.portion) !in served
            }
        return YearDownload.Applied(
            year = year,
            inserted = tally.inserted,
            replaced = tally.replaced,
            unchanged = tally.unchanged,
            keptUnsynced = tally.keptUnsynced,
            absentFromServer = absent,
        )
    }

    private suspend fun apply(
        account: String,
        incoming: List<EntryEntity>,
    ): Tally {
        val tally = Tally()
        for (row in incoming) {
            val local = dao.byAccountDayPortion(account, row.dayDate, row.portion)
            when {
                local == null -> {
                    dao.upsert(row)
                    tally.inserted++
                }
                local.syncState != SyncState.SYNCED -> tally.keptUnsynced++
                local == row -> tally.unchanged++
                else -> {
                    dao.upsert(row)
                    tally.replaced++
                }
            }
        }
        return tally
    }

    /** What one GET produced, before anything is written. */
    private sealed interface Fetched {
        data class Rows(val rows: List<EntryEntity>) : Fetched

        /** Unreachable, refused, or a body that is not this whole year (R484). */
        data object NotTheYear : Fetched

        /** No usable session (R484: ends quietly). */
        data object SessionGone : Fetched
    }

    private class Tally {
        var inserted = 0
        var replaced = 0
        var unchanged = 0
        var keptUnsynced = 0
    }
}

/**
 * The year as local rows for [account], or null when [body] is not this WHOLE year: not the year's envelope, a year
 * other than the one asked for, a row outside it, a (dayDate, portion) served twice, or a value this build does not
 * know (6.5 - an unrecognised kind is never guessed into a known one; KMP-3's mapping throws on it). Pure, and
 * called before any write, so a body that fails here changes nothing.
 */
private fun wholeYearOf(
    body: String,
    year: Int,
    account: String,
): List<EntryEntity>? {
    val rows =
        parseEntriesYearResponse(body)?.takeIf { it.year == year }?.let { response ->
            runCatching { response.entries.map { it.toSyncedEntity(account) } }.getOrNull()
        }
    return rows?.takeIf { all ->
        all.all { it.inYear(year) } && all.mapTo(HashSet()) { it.dayDate to it.portion }.size == all.size
    }
}

private fun EntryEntity.inYear(year: Int): Boolean = dayDate.startsWith("$year-")
