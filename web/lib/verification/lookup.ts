// web/lib/verification/lookup.ts
//
// The one place the verification page reads an issuance record. FW-VERIFY (R330).
//
// ============================================================================
// THE SELECT IS THE PRIVACY BOUNDARY, AND IT IS WHY THIS IS A SEPARATE FILE
// ============================================================================
//
// R330: the page shows ONLY what is printed on the releve, and NEVER the email,
// the account, or anything not on the document. The strongest way to guarantee
// "never the email" is to make it UNREACHABLE from here: this query selects the
// printed columns and nothing else - no `userId`, no `user` relation - so the
// email is not even loaded, let alone rendered. A test asserts the email is
// absent from the view a known account produced; this is what makes that true
// rather than hoping a renderer leaves it out.
//
// ============================================================================
// UNKNOWN AND WITHDRAWN ARE THE SAME ANSWER, BY THE SAME PATH
// ============================================================================
//
// R330: "no difference in content or timing between 'never existed' and
// 'erased'". An erased record is gone (it cascades with the account), so an
// erased code and a code that never existed both resolve to `null` here, through
// one findUnique. A malformed code is rejected before the query - it cannot name
// a real record, so it is the same `null`, and it keeps a flood of garbage off
// the database.

import { prisma } from '@/lib/db/client';

/** Exactly what the verification page may show - the printed fields, no more. */
export interface VerificationView {
  /** The name AS PRINTED. Never a former name (R331); the record holds one name. */
  readonly name: string;
  readonly taxYear: number;
  readonly version: number;
  readonly declarableRate: number;
  readonly teleworkDays: number;
  readonly missionDaysFrance: number;
  readonly missionDaysThirdState: number;
  readonly periodFraction: number;
  readonly periodStartDate: string | null;
  /** When the document was issued, ISO. */
  readonly generatedAt: string;
  /**
   * When a newer version was issued, ISO, or null when this is the current one.
   * It IS the supersession instant (the writer stamps it with the successor's
   * generatedAt), so the page says "a newer version was issued on <date>"
   * without a second query and without naming the newer version's figures.
   */
  readonly supersededAt: string | null;
}

/**
 * The columns the page shows, and the whole of them.
 *
 * NO userId, NO user relation: the email cannot be loaded, so it cannot leak.
 */
const SELECT = {
  name: true,
  taxYear: true,
  version: true,
  declarableRate: true,
  teleworkDays: true,
  missionDaysFrance: true,
  missionDaysThirdState: true,
  periodFraction: true,
  periodStartDate: true,
  generatedAt: true,
  supersededAt: true,
} as const;

/** A code is 128 bits of hex. Anything else cannot be a real one (R133). */
const CODE = /^[0-9a-f]{32}$/u;

/**
 * Resolve a code to what the page may show, or null for unknown / withdrawn /
 * malformed - the one neutral answer.
 */
export async function lookupVerification(code: string): Promise<VerificationView | null> {
  if (!CODE.test(code)) return null;

  const row = await prisma.issuanceRecord.findUnique({ where: { code }, select: SELECT });

  if (row === null) return null;

  return {
    name: row.name,
    taxYear: row.taxYear,
    version: row.version,
    declarableRate: row.declarableRate,
    teleworkDays: row.teleworkDays,
    missionDaysFrance: row.missionDaysFrance,
    missionDaysThirdState: row.missionDaysThirdState,
    periodFraction: row.periodFraction,
    periodStartDate: row.periodStartDate,
    generatedAt: row.generatedAt.toISOString(),
    supersededAt: row.supersededAt === null ? null : row.supersededAt.toISOString(),
  };
}
