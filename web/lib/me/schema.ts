// web/lib/me/schema.ts
//
// What PATCH /api/v1/me accepts. FW26 increment 2.
//
// ============================================================================
// THIS FILE VALIDATES SHAPE. THE DATABASE VALIDATES THE INVARIANTS.
// ============================================================================
//
// SPEC §8 states two rules about these columns - `employmentRate` is 1–100,
// and `exactTotalWorkDays` is required iff `denominatorKind = EXACT` - and
// R196 put BOTH in the database as CHECK constraints, precisely so they
// "survive a writer who does not know they exist". This route is one such
// writer. The engine validates them a second time for its own inputs.
//
// A THIRD COPY HERE WOULD BE THE DEFECT, not the safety net it looks like.
// Three enforcers of one rule is three places to change when SPEC moves, and
// the one that gets missed goes on accepting what the others refuse - with no
// test failing, because each is internally consistent. So this file says
// "integer" and the database says "1 to 100", and the route turns the
// database's refusal into a named answer (R198).
//
// The cost is a round trip to discover a bad value. The benefit is that the
// bound has exactly one home, and it is the one that also protects the seed,
// the migrations and every future admin path.
//
// ============================================================================
// CONSENT IS A BOOLEAN HERE AND A TIMESTAMP IN THE DATABASE
// ============================================================================
//
// The client sends `detectionConsent: true | false`. It does NOT send
// `detectionConsentAt`, because timestamps are server-assigned everywhere in
// this product - the same rule that keeps `recordedAt` off the entries wire.
// A client that could name the moment it consented could name a moment it
// did not.

import { z } from 'zod';
import { CANTON_NAMES } from '@/lib/fr/cantons';

/**
 * The cantons, derived from the module that already lists them.
 *
 * R206: `lib/fr/cantons.ts` is keyed by the engine's own `Canton` union, so a
 * canton added to the engine and not to that file is already a type error
 * there. Re-typing 26 codes here would be a list that silently disagrees.
 */
const CANTON_CODES = Object.keys(CANTON_NAMES) as [string, ...string[]];

/** `HH:mm`, 24-hour. A wall-clock time, not an instant - see the schema. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/u;

/** An ISO day with no time part: the activity start is a DAY (R28). */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;

const meObject = z.object({
  // AN-ONBOARD: the holder's name, the document's titulaire. Settable here so
  // onboarding's step 1 writes it (the column already existed; nothing wrote it
  // from a client before). Trimmed, and non-empty once trimmed: the dossier and
  // the PDF refuse to generate without a titulaire (R205), so a name that trims
  // to nothing is refused at the door rather than stored to fail later. Capped so
  // it stays a key the CSV/PDF filename can carry.
  name: z.string().trim().min(1).max(120),
  canton: z.enum(CANTON_CODES),
  // INTEGER ONLY. The 1–100 bound belongs to the database (R196); saying it
  // again here is the third copy this file's header refuses.
  employmentRate: z.number().int(),
  denominatorKind: z.enum(['SIMPLIFIED240', 'EXACT']),
  // Nullable rather than optional: `null` is how a client CLEARS it when
  // moving back to the simplified basis, and the iff-constraint then holds.
  exactTotalWorkDays: z.number().int().positive().nullable(),
  granularity: z.enum(['DAY', 'HALF_DAY']),
  activityStartDate: z.string().regex(ISO_DAY).nullable(),
  reminderTime: z.string().regex(TIME_OF_DAY),
  reminderEnabled: z.boolean(),
  loggingMode: z.enum(['MANUAL', 'AUTO_DETECT']),
  /**
   * Grant or revoke. The server stamps or clears `detectionConsentAt`.
   *
   * SPEC §13 forbids detection without consent, so revoking here also forces
   * `loggingMode` to MANUAL - in the same write, server-side, rather than
   * trusting a client to stop asking. A revocation that left AUTO_DETECT
   * standing would be a setting that says one thing and a system that does
   * another.
   */
  detectionConsent: z.boolean(),
});

/** Every key PATCH understands, for the "unknown field" refusal and the docs. */
export const ME_PATCH_FIELDS = Object.keys(meObject.shape).sort();

/**
 * A PATCH body: any subset, at least one key, nothing unknown.
 *
 * `.strict()` rather than stripping, for the reason the entries route refuses
 * unknown parameters: a client that misspells a field and receives 200 has
 * been told its change was saved.
 */
export const mePatchSchema = meObject
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'at least one field must be present',
  });

export type MePatch = z.infer<typeof mePatchSchema>;
