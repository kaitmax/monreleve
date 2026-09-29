package ch.monreleve.app.releve

import ch.monreleve.app.dossier.DossierMonth

// AN11 increment 1. The ONE device-side arithmetic on the Releve screen, kept in one named place so it is
// not mistaken for the recomputation FW12 forbids.
//
// todo.md AN11 mandates the mobile monthly table merge the two mission columns (Mission FR + Mission
// tiers) into one "Miss." column - the split lives in the annex and the PDF (FD7 section 6). This sums the
// two fields the server already carries, exactly as web/lib/dossier/service.ts builds tiles.missionDays.
// It derives nothing the payload does not already hold; it adds two of its own numbers. A test asserts it,
// and a plant proves the test bites.

/** The mobile table's merged missions column: Mission FR + Mission tiers, from the server's own fields. */
fun mergedMissionDays(month: DossierMonth): Double = month.missionDaysFrance + month.missionDaysThirdState
