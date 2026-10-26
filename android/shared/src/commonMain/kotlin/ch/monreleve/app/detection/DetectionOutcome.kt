package ch.monreleve.app.detection

// IOS-1b-A R602: MOVED FROM :app to :shared commonMain (package unchanged), so the shared Aujourd'hui controller
// can read it on every platform. Platform-free as it stood.
// AN-AUTO increment 1 (R311). THE PRODUCT LAYER OVER THE PROPOSAL: only HIGH proposes.
//
// R311 REVERSES SPEC 13.1/11.2's "MEDIUM proposes, LOW withholds". In the PRODUCT, a day is shown a
// proposal ONLY when its tier is HIGH; MEDIUM and LOW both withhold and show the not-sure message
// (R312, DetectionCopy.NOT_SURE). Fewer proposals, fewer wrong ones - the risk the field protocol names
// (a confident, wrong HIGH day) is the one no message can cover, so the product narrows what it will
// propose at all until the field test measures the rate.
//
// THE MEASUREMENT PATH IS UNCHANGED. computeProposal / proposedKind / exportFieldRun still score HIGH
// and MEDIUM separately (the field protocol's §3 table), so a field run is scored against exactly what
// AN6a built. This layer sits ABOVE them: it reads the Proposal they produce and decides what the
// PERSON sees. detectionOutcome is the one place that decision is made (R206), so the Aujourd'hui auto
// surface and the seven-track replay both go through it and cannot disagree.
//
// NOTHING HERE WRITES AN ENTRY (D16). A DetectionOutcome is a value; only the confirming tap records.

/** What the product shows for a day in automatic mode. */
sealed interface DetectionOutcome {
    /** A HIGH-tier day: the proposal is shown for the person to confirm or correct (R314). */
    data class Proposed(val proposal: Proposal) : DetectionOutcome

    /** MEDIUM, LOW, or no proposal at all: the day withholds and shows the not-sure message (R312). */
    data object NotSure : DetectionOutcome
}

/**
 * R311: a proposal is surfaced to the person ONLY when its tier is HIGH. A MEDIUM proposal (which the
 * measurement path still produces) and a withheld day (null) both become NotSure - the not-sure message.
 */
fun detectionOutcome(proposal: Proposal?): DetectionOutcome =
    if (proposal != null && proposal.tier == Tier.HIGH) {
        DetectionOutcome.Proposed(proposal)
    } else {
        DetectionOutcome.NotSure
    }
