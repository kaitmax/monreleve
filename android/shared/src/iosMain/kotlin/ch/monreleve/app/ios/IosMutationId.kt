package ch.monreleve.app.ios

import platform.Foundation.NSUUID

// IOS-1a R568. The mutation id the record path mints at the tap: a LOWER-CASE v4 UUID, the same format
// java.util.UUID.toString() gives on Android, so one id format crosses the wire (REPORT-KMP-4 Q1, R472 item 1).
// NSUUID is a random (version 4) UUID; its string form is UPPER case, so it is lower-cased here. Passed as the
// `newMutationId` seam of LocalEntryRepository - which has no default, deliberately.
fun newIosMutationId(): String = NSUUID().UUIDString().lowercase()
