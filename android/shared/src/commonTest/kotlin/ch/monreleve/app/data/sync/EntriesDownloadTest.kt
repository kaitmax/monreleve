package ch.monreleve.app.data.sync

import ch.monreleve.app.account.UNOWNED_ACCOUNT
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpResponse
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

// AN-PULL (R481-R487). The download's behaviour, in commonTest so iOS inherits it (R482): the REAL SessionManager
// and AuthApi over a recording HttpTransport, and an in-memory EntryDao (DownloadRig.kt says why each fake exists).
//
// EVERY ABSENCE HERE HAS ITS POSITIVE CONTROL. "Nothing changed" is satisfied perfectly by a download that never
// ran, so each test that asserts something was NOT written also asserts that the GET was made, or that the rest of
// the year DID land. That is also what makes them red against the skeleton, which does nothing (R487).

private val APRIL_7 =
    serverRow(
        id = "cly3k8qv10001s6a1b2c3d4e5",
        mutation = "9f1c0f2e-7b3a-4a6d-9f21-0b2d4c6e8a10",
        day = "2026-04-07",
        kind = "CH",
        note = "Bureau Genève",
        provenance = "DETECTED_CORRECTED",
        detectedKind = "HOME",
        detectedAt = "2026-04-07T17:02:11.000Z",
        clientClaimedAt = "2026-04-07T18:44:02.000Z",
        firstRecordedAt = "2026-04-07T18:44:09.311Z",
    )
private val APRIL_8_AM = serverRow(id = "srv-2", mutation = "m-2", day = "2026-04-08", portion = "AM", kind = "HOME")
private val APRIL_8_PM =
    serverRow(
        id = "srv-3",
        mutation = "m-3",
        day = "2026-04-08",
        portion = "PM",
        kind = "ABSENT",
        absenceReason = "CONGE",
        lastModifiedAt = "2026-04-09T08:00:00.123Z",
    )

/** What a phone last synced for 7 April before the day was edited elsewhere: the same row id, an older write. */
private val APRIL_7_OLDER_WRITE =
    serverRow(id = "cly3k8qv10001s6a1b2c3d4e5", mutation = "older-write", day = "2026-04-07", kind = "HOME")
private val NEW_YEARS_EVE = serverRow(id = "srv-25", mutation = "m-25", day = "2025-12-31", kind = "MISSION_THIRD")

private val YEAR_2026 = listOf(APRIL_7, APRIL_8_AM, APRIL_8_PM)
private val BOTH_YEARS = mapOf(2026 to YEAR_2026, 2025 to listOf(NEW_YEARS_EVE))

private fun keyOf(row: EntryEntity) = Triple(row.accountTag, row.dayDate, row.portion)

/** An Applied outcome, naming only the counts that are not zero. */
@Suppress("LongParameterList")
private fun applied(
    year: Int,
    inserted: Int = 0,
    replaced: Int = 0,
    unchanged: Int = 0,
    keptUnsynced: Int = 0,
    absentFromServer: Int = 0,
): YearDownload = YearDownload.Applied(year, inserted, replaced, unchanged, keptUnsynced, absentFromServer)

class EntriesDownloadTest {
    // ----- R487 (1) / R481: a fresh store receives both years ---------------------------------------------------

    @Test
    fun aFreshStoreReceivesBothYears() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))

            val outcomes = rig.download.downloadYears(listOf(2026, 2025))

            assertEquals(
                listOf<YearDownload>(
                    applied(2026, inserted = 3),
                    applied(2025, inserted = 1),
                ),
                outcomes,
            )
            assertEquals(
                setOf(syncedFrom(APRIL_7), syncedFrom(APRIL_8_AM), syncedFrom(APRIL_8_PM), syncedFrom(NEW_YEARS_EVE)),
                rig.dao.rows.values.toSet(),
            )
            assertEquals(listOf("GET /api/v1/entries?year=2026", "GET /api/v1/entries?year=2025"), rig.requestLines())
        }

    // ----- R487 (2) / R483: a pending day survives the download -------------------------------------------------

    @Test
    fun aPendingDaySurvivesTheDownload() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))
            // The person's newer choice for a day the server also holds - not yet sent.
            val pending = localRow("2026-04-08", Portion.AM, EntryKind.CH, SyncState.PENDING)
            rig.dao.seed(pending)

            val outcome = rig.download.download(2026)

            assertEquals(
                applied(2026, inserted = 2, keptUnsynced = 1),
                outcome,
            )
            assertEquals(pending, rig.dao.rows[keyOf(pending)], "the pending row is kept exactly as it was")
            // Positive control: the rest of the year DID arrive around it.
            assertEquals(syncedFrom(APRIL_7), rig.dao.rows[keyOf(syncedFrom(APRIL_7))])
            assertEquals(syncedFrom(APRIL_8_PM), rig.dao.rows[keyOf(syncedFrom(APRIL_8_PM))])
        }

    @Test
    fun aRowTheServerRefusedIsKeptToo() =
        runTest {
            // R483 replaces only a SYNCED row. A FAILED row was sent and refused (R296) - the person's choice, held
            // loud and out of the queue - so it is not the server's to overwrite either (PARK-Y2).
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))
            val refused = localRow("2026-04-07", Portion.FULL, EntryKind.HOME, SyncState.FAILED)
            rig.dao.seed(refused)

            val outcome = rig.download.download(2026)

            assertEquals(
                applied(2026, inserted = 2, keptUnsynced = 1),
                outcome,
            )
            assertEquals(refused, rig.dao.rows[keyOf(refused)])
        }

    // ----- R487 (3) / R483: a SYNCED row the server changed is updated -------------------------------------------

    @Test
    fun aSyncedRowTheServerChangedIsReplacedByTheServersRow() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))
            // What this phone last synced for 7 April: an older write, since edited elsewhere (6.4: the last write
            // sent is not necessarily the one kept).
            val stale =
                syncedFrom(APRIL_7_OLDER_WRITE)
            rig.dao.seed(stale)

            val outcome = rig.download.download(2026)

            assertEquals(
                applied(2026, inserted = 2, replaced = 1),
                outcome,
            )
            assertEquals(
                syncedFrom(APRIL_7),
                rig.dao.rows[keyOf(stale)],
                "the server's row replaces it, field for field",
            )
        }

    // ----- R487 (4) / R483 + AN-CALENDAR: an identical row is not rewritten --------------------------------------

    @Test
    fun anIdenticalRowIsNotRewritten() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))
            rig.dao.seed(syncedFrom(APRIL_7), syncedFrom(APRIL_8_AM))

            val outcome = rig.download.download(2026)

            assertEquals(
                applied(2026, inserted = 1, unchanged = 2),
                outcome,
            )
            // Exactly ONE write - the row that was missing. The two identical rows cost nothing.
            assertEquals(1, rig.dao.upserts, "nothing changed, nothing written")
            assertEquals(syncedFrom(APRIL_8_PM), rig.dao.rows[keyOf(syncedFrom(APRIL_8_PM))])
        }

    // ----- R487 (5) / R483: a server-absent SYNCED row is kept and counted ---------------------------------------

    @Test
    fun aSyncedRowTheServerDoesNotHoldIsKeptAndCounted() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))
            // Entries have no DELETE, so a synced row the server no longer holds is an anomaly - kept, counted.
            val orphan = localRow("2026-03-02", Portion.FULL, EntryKind.HOME, SyncState.SYNCED)
            // A PENDING row the server does not hold yet is not an anomaly: it simply has not been sent.
            val unsent = localRow("2026-03-03", Portion.FULL, EntryKind.CH, SyncState.PENDING)
            rig.dao.seed(orphan, unsent)

            val outcome = rig.download.download(2026)

            assertEquals(
                applied(2026, inserted = 3, absentFromServer = 1),
                outcome,
            )
            assertEquals(orphan, rig.dao.rows[keyOf(orphan)], "kept, not deleted")
            assertEquals(unsent, rig.dao.rows[keyOf(unsent)])
        }

    // ----- R487 (6) / R483 + R303: another account's and UNOWNED rows are untouched, and never read ---------------

    @Test
    fun anotherAccountsRowsAndUnownedRowsAreNeverReadChangedOrShown() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))
            val theirRow = serverRow(id = "b-1", mutation = "b-m-1", day = "2026-04-07", kind = "MISSION_FR")
            val theirs = syncedFrom(theirRow, ACCOUNT_B)
            val theirPending =
                localRow("2026-05-01", Portion.FULL, EntryKind.HOME, SyncState.PENDING, account = ACCOUNT_B)
            val unowned = localRow("2026-04-08", Portion.AM, EntryKind.CH, SyncState.PENDING, account = UNOWNED_ACCOUNT)
            rig.dao.seed(theirs, theirPending, unowned)

            val outcome = rig.download.download(2026)

            assertEquals(
                applied(2026, inserted = 3),
                outcome,
            )
            assertEquals(theirs, rig.dao.rows[keyOf(theirs)])
            assertEquals(theirPending, rig.dao.rows[keyOf(theirPending)])
            assertEquals(unowned, rig.dao.rows[keyOf(unowned)])
            // The same day for A sits BESIDE B's, never on top of it.
            assertEquals(syncedFrom(APRIL_7), rig.dao.rows[Triple(ACCOUNT_A, "2026-04-07", Portion.FULL)])
            // Never READ: every read the download issued named A. Positive control first - reads happened.
            assertTrue(rig.dao.readTags.isNotEmpty(), "the download read nothing at all")
            assertEquals(setOf(ACCOUNT_A), rig.dao.readTags.toSet(), "a read reached another account's rows")
        }

    // ----- R487 (7) / R484: a failure mid-year leaves the store unchanged ----------------------------------------

    @Test
    fun aWriteThatFailsPartWayThroughTheYearLeavesTheStoreAsItWas() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))
            rig.dao.seed(
                localRow("2026-04-08", Portion.AM, EntryKind.CH, SyncState.PENDING),
                syncedFrom(APRIL_7_OLDER_WRITE),
            )
            val before = LinkedHashMap(rig.dao.rows)
            rig.dao.failOnWrite = 2

            assertFailsWith<IllegalStateException> { rig.download.download(2026) }

            // Positive control: a write DID land before the failure - and the transaction took it back.
            assertEquals(1, rig.dao.upserts, "the first write of the year landed before the planted failure")
            assertEquals(before, rig.dao.rows, "a year arrives whole or not at all")
        }

    @Test
    fun aYearTheServerCannotServeWholeChangesNothing() =
        runTest {
            // 6.2: "A year that cannot be served whole is read_failed, never a partial success."
            val rig = DownloadRig(respond = { HttpResponse(500, READ_FAILED_BODY) })
            val pending = localRow("2026-04-08", Portion.AM, EntryKind.CH, SyncState.PENDING)
            rig.dao.seed(pending)

            val outcome = rig.download.download(2026)

            assertEquals(YearDownload.Failed(2026), outcome)
            assertEquals(listOf("GET /api/v1/entries?year=2026"), rig.requestLines(), "the server was asked")
            assertEquals(mapOf(keyOf(pending) to pending), rig.dao.rows.toMap())
            assertEquals(0, rig.dao.transactions)
        }

    @Test
    fun aBodyThatIsNotTheWholeYearChangesNothing() =
        runTest {
            val notTheYear =
                listOf(
                    // the year that was not asked for
                    yearBody(2025, listOf(NEW_YEARS_EVE)),
                    // a row outside the year it claims
                    yearBody(2026, listOf(APRIL_7, NEW_YEARS_EVE)),
                    // a sixth kind (6.5: an unknown enum is never guessed into a known one)
                    yearBody(
                        2026,
                        listOf(APRIL_7, serverRow(id = "x", mutation = "x", day = "2026-04-09", kind = "SIXTH")),
                    ),
                    // the same (dayDate, portion) twice
                    yearBody(2026, listOf(APRIL_7, APRIL_7)),
                    // a refusal envelope, and a body that is not JSON at all
                    """{"status":"error","code":"invalid_year","message":"x"}""",
                    """{"status":"ok","year":2026,"entr""",
                )
            for (body in notTheYear) {
                val rig = DownloadRig(respond = { HttpResponse(200, body) })

                val outcome = rig.download.download(2026)

                assertEquals(YearDownload.Failed(2026), outcome, body)
                assertEquals(1, rig.transport.requests.size, "the server was asked: $body")
                assertTrue(rig.dao.rows.isEmpty(), "nothing was written for: $body")
            }
        }

    @Test
    fun anUnreachableServerChangesNothing() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.unreachable)
            val synced = syncedFrom(APRIL_7)
            rig.dao.seed(synced)

            val outcome = rig.download.download(2026)

            assertEquals(YearDownload.Failed(2026), outcome)
            assertEquals(1, rig.transport.requests.size, "the GET was attempted")
            assertEquals(mapOf(keyOf(synced) to synced), rig.dao.rows.toMap())
        }

    // ----- R486 / R487 (8): the download makes no writes the person did not make ---------------------------------

    @Test
    fun theDownloadMakesNoWritesThePersonDidNotMake() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))

            rig.download.downloadYears(listOf(2026, 2025))

            // Positive control: four rows arrived.
            assertEquals(4, rig.dao.rows.size)
            // The mutation queue is empty (R340's shape - asserted, not assumed): no row is PENDING.
            assertEquals(emptyList(), rig.dao.rows.values.filter { it.syncState == SyncState.PENDING })
            assertTrue(rig.dao.rows.values.all { it.syncState == SyncState.SYNCED })
            // The transport received only GETs - nothing was sent back.
            assertTrue(rig.transport.requests.all { it.method == HttpMethod.GET }, rig.requestLines().toString())
            // Every row carries the signed-in account.
            assertEquals(setOf(ACCOUNT_A), rig.dao.rows.values.map { it.accountTag }.toSet())
            // The server's values, exactly: firstRecordedAt byte for byte, its mutation id (none minted), its id.
            val april7 = rig.dao.rows.getValue(Triple(ACCOUNT_A, "2026-04-07", Portion.FULL))
            assertEquals("2026-04-07T18:44:09.311Z", april7.firstRecordedAt)
            assertEquals("9f1c0f2e-7b3a-4a6d-9f21-0b2d4c6e8a10", april7.clientMutationId)
            assertEquals("cly3k8qv10001s6a1b2c3d4e5", april7.serverId)
            assertEquals("2026-04-07T18:44:02.000Z", april7.clientClaimedAt)
            assertEquals("2026-04-07T17:02:11.000Z", april7.detectedAt)
            assertEquals(
                "2026-04-09T08:00:00.123Z",
                rig.dao.rows.getValue(Triple(ACCOUNT_A, "2026-04-08", Portion.PM)).lastModifiedAt,
            )
            // Every write happened inside a transaction - one per year.
            assertEquals(0, rig.dao.writesOutsideTransaction)
            assertEquals(2, rig.dao.transactions)
        }

    // ----- R487 (9) / R485: the start check downloads only when the year is empty locally ------------------------

    @Test
    fun theStartCheckFindsOnlyTheYearThatIsEmptyLocally() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))
            // A has 2026 on the phone; B has 2025 - which must not make A's 2025 look present (R303).
            rig.dao.seed(
                syncedFrom(APRIL_7),
                localRow("2025-06-02", Portion.FULL, EntryKind.CH, SyncState.SYNCED, account = ACCOUNT_B),
            )

            val empty = rig.download.emptyLocally(listOf(2026, 2025))
            assertEquals(listOf(2025), empty)
            rig.download.downloadYears(empty)

            assertEquals(listOf("GET /api/v1/entries?year=2025"), rig.requestLines(), "only the empty year is fetched")
            assertEquals(syncedFrom(NEW_YEARS_EVE), rig.dao.rows[Triple(ACCOUNT_A, "2025-12-31", Portion.FULL)])
        }

    @Test
    fun theStartCheckFetchesNothingWhenBothYearsAreOnThePhone() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))
            rig.dao.seed(syncedFrom(APRIL_7), syncedFrom(NEW_YEARS_EVE))

            assertEquals(emptyList(), rig.download.emptyLocally(listOf(2026, 2025)))
            // Positive control: the check did read the account's rows.
            assertTrue(ACCOUNT_A in rig.dao.readTags)
            assertEquals(emptyList(), rig.requestLines())
        }

    @Test
    fun withNoAccountTheStartCheckFindsNothingToFetch() =
        runTest {
            val rig = DownloadRig(respond = DownloadRig.serving(BOTH_YEARS))
            // Positive control: signed in, a fresh store has both years to fetch.
            assertEquals(listOf(2026, 2025), rig.download.emptyLocally(listOf(2026, 2025)))

            rig.account = null

            // Signed out, nothing is anybody's to fetch (R303: fail closed).
            assertEquals(emptyList(), rig.download.emptyLocally(listOf(2026, 2025)))
            assertEquals(emptyList(), rig.requestLines())
        }

    // ----- R484: a 401 goes through KMP-3's refresh; Unauthenticated ends quietly --------------------------------

    @Test
    fun anExpiredAccessTokenIsRefreshedOnceAndTheYearStillArrives() =
        runTest {
            val rig =
                DownloadRig { request ->
                    when {
                        request.url.endsWith("/api/v1/auth/refresh") -> HttpResponse(200, PAIR_BODY)
                        request.headers["Authorization"] == "Bearer access-1" -> HttpResponse(401, EXPIRED_BODY)
                        else -> HttpResponse(200, yearBody(2026, YEAR_2026))
                    }
                }

            val outcome = rig.download.download(2026)

            assertEquals(
                applied(2026, inserted = 3),
                outcome,
            )
            assertEquals(
                listOf("GET /api/v1/entries?year=2026", "POST /api/v1/auth/refresh", "GET /api/v1/entries?year=2026"),
                rig.requestLines(),
            )
            assertEquals("access-2", rig.tokens.load()?.accessToken, "the rotated pair was stored")
        }

    @Test
    fun aSessionThatCannotBeRefreshedEndsQuietlyAndWritesNothing() =
        runTest {
            val rig =
                DownloadRig { request ->
                    if (request.url.endsWith("/api/v1/auth/refresh")) {
                        HttpResponse(401, """{"status":"error","code":"invalid_refresh_token"}""")
                    } else {
                        HttpResponse(401, EXPIRED_BODY)
                    }
                }
            val pending = localRow("2026-04-08", Portion.AM, EntryKind.CH, SyncState.PENDING)
            rig.dao.seed(pending)

            val outcomes = rig.download.downloadYears(listOf(2026, 2025))

            assertEquals(
                listOf<YearDownload>(YearDownload.Unauthenticated(2026)),
                outcomes,
                "the second year is not tried",
            )
            assertEquals(listOf("GET /api/v1/entries?year=2026", "POST /api/v1/auth/refresh"), rig.requestLines())
            assertEquals(mapOf(keyOf(pending) to pending), rig.dao.rows.toMap())
        }

    @Test
    fun withNoAccountNothingIsFetched() =
        runTest {
            val rig = DownloadRig(account = null, respond = DownloadRig.serving(BOTH_YEARS))

            assertEquals(YearDownload.Unauthenticated(2026), rig.download.download(2026))
            assertEquals(emptyList(), rig.requestLines())
        }

    @Test
    fun anAccountThatChangesWhileTheYearIsInFlightWritesNothing() =
        runTest {
            // A downloads; before the answer is applied, the phone is signed in as B. A's rows must not be written
            // under B's tag, nor under A's after A has left (R303). The GET is made - the positive control.
            lateinit var rig: DownloadRig
            rig =
                DownloadRig { request ->
                    rig.account = ACCOUNT_B
                    DownloadRig.serving(BOTH_YEARS)(request)
                }

            val outcome = rig.download.download(2026)

            assertEquals(YearDownload.Unauthenticated(2026), outcome)
            assertEquals(listOf("GET /api/v1/entries?year=2026"), rig.requestLines())
            assertTrue(rig.dao.rows.isEmpty())
            assertEquals(0, rig.dao.upserts)
        }
}
