package ch.monreleve.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import ch.monreleve.app.account.UNOWNED_ACCOUNT

// AN-FORECAST (R341, R303). The weekly rhythm - Monday to Friday, each Suisse or Domicile - kept ON
// THE PHONE as a planning preference.
//
// IT IS NOT A RECORD AND NOT ON THE WIRE (R340, R341). The rhythm feeds projections only; it is never
// sent to the server, so there is NO new server field and the privacy notice is unchanged. Re-entering
// five taps on a new phone is the accepted cost.
//
// ACCOUNT-TAGGED AND CLEARED ON SIGN-OUT (R303 / R295). One row per account (PK accountTag, the same
// opaque local tag the entry table uses); clearAllTables() - derived from @Database - sweeps this table
// with the record on sign-out and on deletion, so a rhythm never outlives its account or leaks to the
// next one on a shared device. Defaults to UNOWNED, the fail-closed sentinel never shown.
//
// D18 - NO COORDINATE COLUMN. A rhythm is five weekday choices, nothing more; RoomSchemaContractTest's
// DDL census asserts no table grows a coordinate column, this one included.
//
// Each weekday is a RhythmKind or NULL (not set). An all-null row, or no row at all, is "no rhythm" -
// the forecast then invites setting one rather than projecting nothing.

@Entity(tableName = "weekly_rhythm")
data class RhythmEntity(
    @PrimaryKey val accountTag: String = UNOWNED_ACCOUNT,
    val monday: RhythmKind?,
    val tuesday: RhythmKind?,
    val wednesday: RhythmKind?,
    val thursday: RhythmKind?,
    val friday: RhythmKind?,
)
