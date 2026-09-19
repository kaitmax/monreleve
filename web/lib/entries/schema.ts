// web/lib/entries/schema.ts
//
// What POST /api/v1/entries accepts. FW23 increment 1.
//
// ============================================================================
// THIS FILE FREEZES THE CONTRACT
// ============================================================================
//
// From FW23 the Android client sends these field names. A rename afterwards
// costs a migration, an app release, and every version still in the field
// sending the old shape - R187 at full force. The names are SPEC 8's, and
// nothing is here that SPEC 8 does not define.
//
// WHAT IS DELIBERATELY ABSENT, because a client must never send it:
//   firstRecordedAt / recordedAt  the server clock, and the whole evidence
//                                 claim. SPEC 8: no API path accepts a
//                                 client-supplied value for these.
//   userId                        tenancy comes from the bearer token and
//                                 from nowhere else (FW22).
//   id                            the server names its own rows.
// Each is rejected as an unknown key rather than ignored - see below.
//
// ============================================================================
// UNKNOWN KEYS ARE REJECTED, NOT STRIPPED
// ============================================================================
//
// Zod strips by default, and stripping is a LIE WITH A SUCCESS CODE. A client
// sending `firstRecordedAt`, or a misspelt `dayDte`, or a `latitude`, would
// get 200 and believe the value was stored. The app then shows a day as
// synced while the server holds something different, and nobody finds out
// until a dossier is wrong a year later.
//
// A client sending a field we do not know is a client we DISAGREE WITH, and
// the disagreement is worth an error while somebody is still writing the
// client. It also does half of AC2's work: a coordinate key cannot be
// silently dropped on the way in.

import { z } from 'zod';

/**
 * How many days one request may carry.
 *
 * TWO HUNDRED, which is roughly a working year's worth of half-days and far
 * more than the offline queue should ever accumulate: WorkManager replays on
 * connectivity, so a backlog this size means the device was offline for
 * months. It is a bound on the WRITE AMPLIFICATION of one request - each item
 * is an upsert plus an event append - not a guess at normal use.
 */
export const MAX_BATCH_ITEMS = 200;

/**
 * How large the body may be, independent of the item count.
 *
 * BOTH LIMITS EXIST BECAUSE `note` IS FREE TEXT. Without a size bound,
 * MAX_BATCH_ITEMS items of maximum note length would decide how much this
 * route reads, which is the item limit quietly setting a much larger one.
 */
export const MAX_BATCH_BODY_BYTES = 256 * 1024;

/** A note is a person's aide-memoire, not a document. */
const MAX_NOTE_LENGTH = 500;

/**
 * A calendar day, as a string, never a Date (R28).
 *
 * `new Date('2026-04-07T00:00:00Z')` is a valid moment and the WRONG DAY for
 * anyone east or west of UTC. A client that serialises a Date sends an
 * instant, and an instant only names a day once you have chosen a zone -
 * which is the choice SPEC 8 makes for the whole product (Europe/Paris) and
 * which a payload must not re-open. So the wire format is the day itself.
 *
 * VALIDATED FOR REAL, not shape-matched: 2026-02-30 and 2026-13-01 match the
 * pattern and are not days. Round-tripping through Date and comparing the
 * string back is what catches them.
 */
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'dayDate must be a calendar day as YYYY-MM-DD, never an instant')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'dayDate is not a real calendar day');

/** An instant the CLIENT is entitled to assert: when it says something happened. */
const clientInstant = z.string().datetime({ offset: true });

const ENTRY_KINDS = ['CH', 'HOME', 'MISSION_FR', 'MISSION_THIRD', 'ABSENT'] as const;
const ABSENCE_REASONS = ['CONGE', 'MALADIE', 'FERIE', 'AUTRE'] as const;
const PORTIONS = ['FULL', 'AM', 'PM'] as const;
const PROVENANCES = ['MANUAL', 'DETECTED_CONFIRMED', 'DETECTED_CORRECTED'] as const;

/**
 * One declared day.
 *
 * `.strict()` IS THE LOAD-BEARING CALL IN THIS FILE. Removing it turns every
 * rejection above into a silent strip.
 */
const entryItemObject = z
  .object({
    /** D30. The client's own id for this write, so a retry is recognised. */
    clientMutationId: z.string().min(1).max(64),

    dayDate: isoDay,

    portion: z.enum(PORTIONS).default('FULL'),

    kind: z.enum(ENTRY_KINDS),

    absenceReason: z.enum(ABSENCE_REASONS).optional(),

    note: z.string().max(MAX_NOTE_LENGTH).optional(),

    provenance: z.enum(PROVENANCES).default('MANUAL'),

    /** What detection proposed, if anything. Orthogonal to provenance (R202). */
    detectedKind: z.enum(ENTRY_KINDS).optional(),

    /** When the proposal was produced on-device. */
    detectedAt: clientInstant.optional(),

    /**
     * What the offline client asserts about when this was written.
     *
     * STORED VERBATIM AND NEVER TRUSTED AS EVIDENCE. SPEC 8 keeps both this
     * and the server's firstRecordedAt, and the dossier shows both - the
     * point being that a reader can see the gap rather than being told a
     * single number and asked to believe it.
     */
    clientClaimedAt: clientInstant.optional(),
  })
  .strict();

/**
 * Every field a client may send, DERIVED FROM THE SCHEMA ITSELF.
 *
 * R206: one text, one home. `docs/api-v1.md` documents these names and
 * tests/unit/meta/api-contract-doc.test.ts asserts the document's list EQUALS
 * this one - so prose and contract cannot drift apart without going red.
 *
 * A HAND-KEPT SECOND LIST WOULD BE A TRANSCRIPTION (R181): correct on the day
 * it was written, silently wrong afterwards, with every suite green. The split
 * between `entryItemObject` and `entryItemSchema` exists only so the shape is
 * readable before the refinements wrap it. No field name changed.
 */
export const ENTRY_ITEM_FIELDS = Object.keys(entryItemObject.shape).sort();

export const entryItemSchema = entryItemObject
  .superRefine((value, context) => {
    // SPEC 8: absenceReason is required iff kind = ABSENT. The database
    // enforces this too (FW21, Entry_absenceReason_iff_absent); here so the
    // client is told which rule it broke rather than meeting a constraint
    // violation.
    if (value.kind === 'ABSENT' && value.absenceReason === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['absenceReason'],
        message: 'absenceReason is required when kind is ABSENT',
      });
    }

    if (value.kind !== 'ABSENT' && value.absenceReason !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['absenceReason'],
        message: 'absenceReason is only allowed when kind is ABSENT',
      });
    }

    // R202, FORWARD ONLY. A DETECTED_* item must say what was proposed;
    // deleting the overridden proposal to tidy the record is a review
    // rejection (SPEC 8).
    //
    // THE REVERSE IS LEGAL AND MUST NOT BE ADDED. A MANUAL item may carry a
    // detectedKind: auto mode proposed, the proposal expired unconfirmed, and
    // the reader backfilled the day later. No proposal was accepted or
    // corrected, so the provenance is MANUAL, and the annex is more honest
    // for recording that detection had proposed something.
    if (value.provenance !== 'MANUAL' && value.detectedKind === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['detectedKind'],
        message: `detectedKind is required when provenance is ${value.provenance}`,
      });
    }
  });

export type EntryItem = z.infer<typeof entryItemSchema>;

/**
 * The batch.
 *
 * AN EMPTY BATCH IS REFUSED rather than answered 200. Zero items means the
 * queue logic sent something it should not have, and acknowledging it hides
 * that for the life of the client.
 */
export const entriesBatchSchema = z
  .object({
    entries: z.array(entryItemSchema).min(1).max(MAX_BATCH_ITEMS),
  })
  .strict()
  .superRefine((value, context) => {
    // TWO ITEMS FOR ONE DAY-AND-PORTION ARE REFUSED, AND A TEST IS WHY THIS
    // EXISTS. The write path upserts on (userId, dayDate, portion), so a batch
    // containing both would not collide - the second would SILENTLY UPDATE the
    // first, and the row would end up holding whichever happened to be last in
    // the array. The database cannot catch it, because an upsert is exactly
    // the instruction not to.
    //
    // SPEC 13.2 says "latest server receipt wins", and two items in one batch
    // share a receipt: there is no later. So the tie has no rule to settle it,
    // and a client sending one is telling the server two things at once. Its
    // queue should have coalesced them; saying so is more useful than picking
    // one.
    const seen = new Map<string, number>();

    value.entries.forEach((entry, index) => {
      const key = `${entry.dayDate}#${entry.portion}`;
      const first = seen.get(key);

      if (first === undefined) {
        seen.set(key, index);

        return;
      }

      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['entries', index],
        message:
          `entries[${index}] repeats ${entry.dayDate} ${entry.portion}, already at ` +
          `entries[${first}]. One batch may not carry two versions of one day.`,
      });
    });

    // AND TWO ITEMS SHARING A clientMutationId, which is the same shape one
    // layer over: the id is the deduplication key (D30), so a batch carrying
    // it twice is asking to be deduplicated against itself. The unique index
    // would refuse the second and roll the batch back - a 500-shaped failure
    // for what is a client mistake with a name.
    const ids = new Map<string, number>();

    value.entries.forEach((entry, index) => {
      const first = ids.get(entry.clientMutationId);

      if (first === undefined) {
        ids.set(entry.clientMutationId, index);

        return;
      }

      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['entries', index],
        message: `entries[${index}] repeats the clientMutationId at entries[${first}].`,
      });
    });
  });

export type EntriesBatch = z.infer<typeof entriesBatchSchema>;
