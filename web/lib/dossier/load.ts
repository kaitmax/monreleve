// web/lib/dossier/load.ts
//
// The one place a dossier is fetched from the database. FW25 increment 1.
//
// ============================================================================
// WHY THIS IS A SEPARATE FILE FROM service.ts
// ============================================================================
//
// `buildDossier` takes data and returns a document. It touches no database, so
// it is testable with fixtures and says nothing about where rows come from.
// This file is the seam: it knows the query, and it is the ONLY thing that
// does.
//
// THREE SURFACES WILL WANT A DOSSIER - the CSV, the print route and the PDF -
// and each writing its own query would be three answers to "which rows are in
// this year". The API read path already had to decide that once (`toStoredDay`,
// inclusive both ends, R28), and the answer must not be re-derived here: a
// dossier whose day window differed from the API's by an hour would disagree
// with the app that displays it.
//
// So the window comes from `readEntriesWhere`, the same function GET
// /api/v1/entries uses. One home (R206).

import { prisma } from '@/lib/db/client';
import { toStoredDay } from '@/lib/entries/day';
import { type Dossier, type AnnexEntry, buildDossier } from '@/lib/dossier/service';

/**
 * The columns the annex needs, which is more than the wire contract exposes.
 *
 * `updatedAt` is deliberately absent - R215 made `lastModifiedAt` a derived
 * fact from the EntryEvent trail, because `updatedAt` differs from
 * `firstRecordedAt` by milliseconds on a row nobody has edited and SPEC 12
 * prints the last-modified stamp "when different".
 */
const SELECT = {
  id: true,
  dayDate: true,
  portion: true,
  kind: true,
  absenceReason: true,
  note: true,
  provenance: true,
  detectedKind: true,
  firstRecordedAt: true,
  clientClaimedAt: true,
} as const;

/**
 * Build the dossier for one person and one year.
 *
 * THE YEAR WINDOW IS BUILT FROM `toStoredDay`, inclusive at both ends, exactly
 * as the API read path builds it. Not similar to it - the same function, for
 * the same reason day.ts has two kinds of helper: `startOfParisDay` is an
 * instant an hour before the day it names, and comparing one against a
 * `@db.Date` column appears to work.
 */
export async function buildDossierFor(
  userId: string,
  year: number,
  // FW-VERIFY: the instant printed on the document. The PDF route assigns it
  // once and passes it both here and into the print URL, so the date printed on
  // the file and the date stored in the issuance record are the same instant.
  // Undefined keeps buildDossier's own `new Date()` default - the behaviour
  // every existing caller relies on.
  generatedAt?: Date,
): Promise<Dossier> {
  const padded = String(year).padStart(4, '0');

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      // SPEC 12 item 1 puts the name first in the header. `buildDossier`
      // refuses without one, so this column is not optional in practice.
      name: true,
      canton: true,
      employmentRate: true,
      denominatorKind: true,
      exactTotalWorkDays: true,
      granularity: true,
      activityStartDate: true,
    },
  });

  const rows = await prisma.entry.findMany({
    where: {
      userId,
      dayDate: {
        gte: toStoredDay(`${padded}-01-01`),
        lte: toStoredDay(`${padded}-12-31`),
      },
    },
    select: SELECT,
    orderBy: { dayDate: 'asc' },
  });

  // R215: the last-modified fact comes from the append-only trail, never from
  // `updatedAt`. One grouped query, bounded by the same 1098 rows the year can
  // hold.
  const ids = rows.map((row) => row.id);

  const modifications =
    ids.length === 0
      ? []
      : await prisma.entryEvent.groupBy({
          by: ['entryId'],
          where: { userId, entryId: { in: ids }, action: 'MODIFIED' },
          _max: { recordedAt: true },
        });

  const lastModified = new Map(
    modifications.map((row) => [row.entryId, row._max.recordedAt ?? null]),
  );

  const entries: AnnexEntry[] = rows.map((row) => ({
    dayDate: row.dayDate,
    portion: row.portion,
    kind: row.kind,
    absenceReason: row.absenceReason,
    note: row.note,
    provenance: row.provenance,
    detectedKind: row.detectedKind,
    firstRecordedAt: row.firstRecordedAt,
    lastModifiedAt: lastModified.get(row.id) ?? null,
    clientClaimedAt: row.clientClaimedAt,
  }));

  // R331: the latest name change WITHIN this tax year, so the document can show
  // "Nom modifie le <date>". A COARSE UTC calendar-year window is deliberate -
  // the line states the year in which the name changed, not a day boundary, and
  // only the DATE is read, never the former name (there is no column for it).
  const [latestChange] = await prisma.nameChange.findMany({
    where: {
      userId,
      changedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
    },
    orderBy: { changedAt: 'desc' },
    take: 1,
    select: { changedAt: true },
  });

  return buildDossier(user, entries, year, generatedAt, latestChange?.changedAt ?? null);
}
