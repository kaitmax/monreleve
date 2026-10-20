package ch.monreleve.app.data.repo

import ch.monreleve.app.account.UNOWNED_ACCOUNT
import ch.monreleve.app.data.local.RhythmDao
import ch.monreleve.app.data.local.RhythmEntity
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.local.toEntryKind
import ch.monreleve.app.data.local.toShared
import ch.monreleve.app.dossier.EntryKind
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.DayOfWeek

// AN-FORECAST (R341, R303). The weekly rhythm, scoped to the account signed in now (the same shape as
// EntryRepository). The rhythm is a local planning preference; this repository is its one writer. No
// server call - the rhythm never leaves the phone (R340/R341).

/** The five weekdays, each SUISSE/DOMICILE or null (not set). An empty rhythm invites setting one. */
data class WeeklyRhythm(
    val monday: RhythmKind? = null,
    val tuesday: RhythmKind? = null,
    val wednesday: RhythmKind? = null,
    val thursday: RhythmKind? = null,
    val friday: RhythmKind? = null,
) {
    /** True when no weekday is set: the forecast then shows the invitation, not an empty projection. */
    val isEmpty: Boolean
        get() = monday == null && tuesday == null && wednesday == null && thursday == null && friday == null

    /** The telework-day count a full rhythm implies, for the helper line ("Soit N jours ... a domicile"). */
    val domicileCount: Int
        get() = listOf(monday, tuesday, wednesday, thursday, friday).count { it == RhythmKind.DOMICILE }

    /**
     * The weekday -> EntryKind map the forecast imagines from (dossier/Forecast.kt). A weekday left null
     * is absent from the map and is not a worked day. KMP-0 (R372): the value is the SHARED dossier
     * EntryKind the platform-free forecast takes, mapped from the local RhythmKind at this :app boundary.
     */
    fun toEntryKindMap(): Map<DayOfWeek, EntryKind> =
        buildMap {
            monday?.let { put(DayOfWeek.MONDAY, it.toEntryKind().toShared()) }
            tuesday?.let { put(DayOfWeek.TUESDAY, it.toEntryKind().toShared()) }
            wednesday?.let { put(DayOfWeek.WEDNESDAY, it.toEntryKind().toShared()) }
            thursday?.let { put(DayOfWeek.THURSDAY, it.toEntryKind().toShared()) }
            friday?.let { put(DayOfWeek.FRIDAY, it.toEntryKind().toShared()) }
        }
}

/** RhythmEntity -> WeeklyRhythm (the account tag is a storage detail the domain does not carry). */
fun RhythmEntity.toWeeklyRhythm(): WeeklyRhythm =
    WeeklyRhythm(
        monday = monday,
        tuesday = tuesday,
        wednesday = wednesday,
        thursday = thursday,
        friday = friday,
    )

/** WeeklyRhythm -> RhythmEntity for [accountTag]. */
fun WeeklyRhythm.toEntity(accountTag: String): RhythmEntity =
    RhythmEntity(
        accountTag = accountTag,
        monday = monday,
        tuesday = tuesday,
        wednesday = wednesday,
        thursday = thursday,
        friday = friday,
    )

interface RhythmRepository {
    /** This account's rhythm, observed; an empty WeeklyRhythm when none is set. */
    fun observe(): Flow<WeeklyRhythm>

    suspend fun save(rhythm: WeeklyRhythm)

    suspend fun clear()
}

/**
 * The Room-backed rhythm repository, scoped to [accountTag]. A null tag (an expired session with no
 * current account) fails closed: nothing is read (UNOWNED has no rhythm) and nothing is written - the
 * same discipline the entry repository uses so one account's data never reaches another (R303).
 */
class LocalRhythmRepository(
    private val dao: RhythmDao,
    // AN-ACCOUNT-TAG (R423): a provider, for the reason LocalEntryRepository gives. A rhythm saved in
    // the sign-in session was lost the same way a recorded day was, and by the same line of code.
    private val accountTag: () -> String?,
) : RhythmRepository {
    override fun observe(): Flow<WeeklyRhythm> =
        dao.observeForAccount(accountTag() ?: UNOWNED_ACCOUNT).map { it?.toWeeklyRhythm() ?: WeeklyRhythm() }

    override suspend fun save(rhythm: WeeklyRhythm) {
        val tag = accountTag() ?: return
        dao.upsert(rhythm.toEntity(tag))
    }

    override suspend fun clear() {
        val tag = accountTag() ?: return
        dao.clearForAccount(tag)
    }
}
