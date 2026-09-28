package ch.monreleve.app.data.local

import androidx.room.Entity

// AN6a increment 3. The day's detection tally, persisted. SPEC 13.1 is explicit about what
// Room may hold here: minutes each side, fix count, buffer-fix count, the window, the tier -
// "No location, no place name, no employer address." There is no coordinate column, and the
// DDL scan (RoomSchemaContractTest, now over EVERY entity) proves it.
//
// The tier is nullable and set at increment 4 (HIGH/MEDIUM/LOW from the tally); a LOW day
// withholds its proposal. One row per calendar day (PK dayDate, an ISO Europe/Paris day, R28).

@Entity(tableName = "daily_tally")
data class TallyEntity(
    @androidx.room.PrimaryKey
    val dayDate: String,
    val minutesSwitzerland: Int,
    val minutesElsewhere: Int,
    val fixCount: Int,
    val bufferFixCount: Int,
    val windowStartMinuteOfDay: Int,
    val windowEndMinuteOfDay: Int,
    val tier: String?,
)
