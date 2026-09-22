// web/lib/me/read.ts
//
// What GET /api/v1/me returns. FW26 increment 2.
//
// ============================================================================
// SETTINGS ARE NOT IDENTITY
// ============================================================================
//
// `email` and `name` are on the same row and are deliberately absent. The
// address is the fact `/confidentialite` promises not to make inferable, and
// §1.5 of the contract goes to some length to keep a sign-in form from
// confirming it - a settings endpoint handing it back on every poll would be
// the same leak through a quieter door.
//
// The name IS returned by the dossier, where it is the document's titulaire
// and the whole point. That is one surface with a reason, not a default.

import type { User } from '@prisma/client';

/**
 * The frozen field set, and the whole of it.
 *
 * ONE HOME (R206): the route serialises this list, the contract test reads it,
 * and a column added to `User` cannot reach the wire without being named here.
 */
export const ME_FIELDS = [
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
