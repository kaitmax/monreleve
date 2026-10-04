package ch.monreleve.app.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity

// R320. The day's detection record, persisted. Under the four-window model a day holds the result of its FOUR
// CHECKS (around 09:30 / 11:00 / 14:30 / 16:30 Paris): each slot is a Classification name - "INSIDE", "OUTSIDE",
// or "BUFFER" - or NULL when that check was MISSED (no fix obtained inside its window). SPEC 13.1 is explicit about
// what Room may hold: a conclusion per day, "no location, no place name, no employer address." There is no
// coordinate column, and the DDL scan (RoomSchemaContractTest, over every entity) proves it.
//
// NO MINUTES, NO TIER COLUMN. The minutes-and-hysteresis tally is gone (R320 replaced it with the vote); the tier
// is DERIVED from the four checks by the vote (Vote.kt), so it is never stored and cannot drift. One row per
// calendar day (PK dayDate, an ISO Europe/Paris day, R28).
//
// AN-NEXT-2 / R324. The PROVIDER COUNTS: how many of the day's taken checks came from GPS, and how many from the
// NETWORK (wifi/cell) fallback AN-NEXT added. COUNTS ONLY - two integers, not a per-check provider label and never
// an accuracy value or a coordinate (D18) - so the field test can see how often network location decided a day
// (gpsCheckCount + networkCheckCount equals the number of checks taken). @ColumnInfo(defaultValue = "0") matches
// the v4->v5 migration's ADD COLUMN ... DEFAULT 0, so a pre-v5 row reads as zero counts rather than failing the
// schema validation. These are STILL not coordinate columns; the DDL scan proves it over every entity.

@Entity(tableName = "daily_tally")
data class TallyEntity(
    @androidx.room.PrimaryKey
    val dayDate: String,
    val check1: String?,
    val check2: String?,
    val check3: String?,
    val check4: String?,
    @ColumnInfo(defaultValue = "0")
    val gpsCheckCount: Int = 0,
    @ColumnInfo(defaultValue = "0")
    val networkCheckCount: Int = 0,
)
