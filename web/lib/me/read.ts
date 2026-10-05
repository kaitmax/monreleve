// web/lib/me/read.ts
//
// What GET /api/v1/me returns. FW26 increment 2.
//
// ============================================================================
// THE NAME IS RETURNED; THE EMAIL IS NOT
// ============================================================================
//
// `email` stays deliberately absent. The address is the fact `/confidentialite`
// promises not to make inferable, and §1.5 of the contract goes to some length
// to keep a sign-in form from confirming it - a settings endpoint handing it
// back on every poll would be the same leak through a quieter door.
//
// `name` IS returned (AN-ONBOARD). Onboarding's step 1 sets it, and a re-sign-in
// on a new phone must be able to SKIP that step when the server already holds a
// name (R297), which it can only do by reading it here. It is the owner's own
// data behind their own bearer token - returning it to them is not the leak the
// email would be. It remains the dossier's titulaire; this is a second surface
// with a reason, not a default.

import type { User } from '@prisma/client';

/**
 * The frozen field set, and the whole of it.
 *
 * ONE HOME (R206): the route serialises this list, the contract test reads it,
 * and a column added to `User` cannot reach the wire without being named here.
 */
export const ME_FIELDS = [
  'name',
  'canton',
  'employmentRate',
  'denominatorKind',
  'exactTotalWorkDays',
  'granularity',
  'activityStartDate',
  'reminderTime',
  'reminderEnabled',
  'loggingMode',
  'detectionConsentAt',
] as const;

/** The columns to select, derived so the query and the payload cannot drift. */
export const ME_SELECT = Object.fromEntries(ME_FIELDS.map((field) => [field, true])) as Record<
  (typeof ME_FIELDS)[number],
  true
>;

type MeRow = Pick<User, (typeof ME_FIELDS)[number]>;

/** One settings row, as the wire carries it. */
export function serialiseMe(row: MeRow): Record<string, unknown> {
  return {
    name: row.name,
    canton: row.canton,
    employmentRate: row.employmentRate,
    denominatorKind: row.denominatorKind,
    exactTotalWorkDays: row.exactTotalWorkDays,
    granularity: row.granularity,
    // A DAY, not an instant (R28). Serialising the whole timestamp would put a
    // midnight UTC time on a field that means "the day I started", and a
    // client in Paris would render the day before for half the year.
    activityStartDate:
      row.activityStartDate === null ? null : row.activityStartDate.toISOString().slice(0, 10),
    reminderTime: row.reminderTime,
    reminderEnabled: row.reminderEnabled,
    loggingMode: row.loggingMode,
    // The full instant: consent is a moment, and the record of when it was
    // given is the point of storing it.
    detectionConsentAt:
      row.detectionConsentAt === null ? null : row.detectionConsentAt.toISOString(),
  };
}
