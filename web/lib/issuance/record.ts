// web/lib/issuance/record.ts
//
// The issuance record writer. FW-VERIFY (R329).
//
// ============================================================================
// EVERY ISSUED RELEVE IS RECORDED, AND THE RECORD IS WHAT MAKES IT VERIFIABLE
// ============================================================================
//
// The PDF route calls recordIssuance after it has produced a file, with the
// SHA-256 of that exact file and the code already printed on it. The record is
// then the server's own statement of what it issued: an accountant who scans
// the code reads these fields back, and an edited PDF, a shared account or a
// name changed after the fact all become visible.
//
// THE FIGURES ARE DERIVED FROM THE DOSSIER, NEVER TRANSCRIBED (R181). The route
// hands this file a Dossier and figuresFromDossier reads the printed numbers
// out of it, so the record cannot drift from the document it describes.
//
// REGENERATION IS LEGITIMATE AND NEVER LIMITED (R329). A new issuance for a
// year that already has one supersedes the previous row - in one transaction,
// stamping the old row with the NEW row's generatedAt, so a superseded row's
// supersededAt is exactly when its successor was issued. The database's partial
// unique index (the migration) refuses two current rows for one year, so this
// transaction is the writer that keeps the rule rather than the only thing that
// could break it.

import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/client';
import type { Dossier } from '@/lib/dossier/service';

/**
 * A fresh verification code: 128 random bits, hex.
 *
 * R329 ASKS FOR AT LEAST 128 RANDOM BITS. 16 bytes is exactly that, and hex
 * keeps it unambiguous for a human typing it off a printed document - no
 * case to get wrong, no characters that look alike. It is unguessable: a
 * million codes a second would take longer than the universe to hit one.
 */
export function newVerificationCode(): string {
  return randomBytes(16).toString('hex');
}

/** The SHA-256 of the produced file, hex - the file's fingerprint. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The printed figures a record holds, and the verification page shows. */
export interface IssuanceFigures {
  /** The titulaire, exactly as printed (R331: never a former name). */
  readonly name: string;
  readonly declarableRate: number;
  readonly teleworkDays: number;
  readonly missionDaysFrance: number;
  readonly missionDaysThirdState: number;
  /** DossierPeriod's own fields, so the page renders the identical sentence. */
  readonly periodFraction: number;
  readonly periodStartDate: string | null;
}

/**
 * Read the printed figures out of a dossier.
 *
 * THE MISSION SPLIT IS SUMMED FROM THE MONTHS, which is where the dossier keeps
 * it per month (the tile carries only the total). Summing the dossier's own
 * rows is reading the source rather than recomputing it from entries (R181).
 */
export function figuresFromDossier(dossier: Dossier): IssuanceFigures {
  const missions = dossier.months.reduce(
    (acc, month) => ({
      france: acc.france + month.missionDaysFrance,
      third: acc.third + month.missionDaysThirdState,
    }),
    { france: 0, third: 0 },
  );

  return {
    name: dossier.titulaire,
    declarableRate: dossier.zone.declarableRate,
    teleworkDays: dossier.tiles.teleworkDays,
    missionDaysFrance: missions.france,
    missionDaysThirdState: missions.third,
    periodFraction: dossier.period.fraction,
    periodStartDate: dossier.period.startDate,
  };
}

export interface RecordIssuanceInput {
  readonly userId: string;
  readonly taxYear: number;
  readonly code: string;
  readonly sha256: string;
  /** The instant printed on the document, assigned by the route's clock. */
  readonly generatedAt: Date;
  readonly figures: IssuanceFigures;
}

export interface IssuanceReceipt {
  readonly code: string;
  readonly version: number;
}

/**
 * Record one issuance, superseding any current version for the same year.
 *
 * ONE TRANSACTION. The supersession and the insert happen together or not at
 * all - a half-done regeneration that superseded the old row without writing
 * the new one would leave a year with no current releve, which is worse than
 * either state alone.
 */
export async function recordIssuance(input: RecordIssuanceInput): Promise<IssuanceReceipt> {
  return prisma.$transaction(async (tx) => {
    // SUPERSEDE WITH THE NEW ROW'S OWN INSTANT, not a second now(): the old
    // row's supersededAt then IS the date its successor was issued, which the
    // verification page reads directly.
    await tx.issuanceRecord.updateMany({
      where: { userId: input.userId, taxYear: input.taxYear, supersededAt: null },
      data: { supersededAt: input.generatedAt },
    });

    const highest = await tx.issuanceRecord.aggregate({
      where: { userId: input.userId, taxYear: input.taxYear },
      _max: { version: true },
    });

    const version = (highest._max.version ?? 0) + 1;

    await tx.issuanceRecord.create({
      data: {
        code: input.code,
        userId: input.userId,
        taxYear: input.taxYear,
        version,
        supersededAt: null,
        name: input.figures.name,
        declarableRate: input.figures.declarableRate,
        teleworkDays: input.figures.teleworkDays,
        missionDaysFrance: input.figures.missionDaysFrance,
        missionDaysThirdState: input.figures.missionDaysThirdState,
        periodFraction: input.figures.periodFraction,
        periodStartDate: input.figures.periodStartDate,
        sha256: input.sha256,
        generatedAt: input.generatedAt,
      },
    });

    return { code: input.code, version };
  });
}
