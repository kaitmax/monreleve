// web/lib/entries/read.ts
//
// What GET /api/v1/entries?year= returns. FW23 increment 4.
//
// ============================================================================
// THIS FILE FREEZES THE READ CONTRACT
// ============================================================================
//
// Same force as schema.ts on the way in: from FW23 the Android client parses
// these field names, and a rename afterwards costs a migration, an app release,
// and every version still in the field (R187).
//
// ============================================================================
// THE YEAR IS THE PAGE. THERE IS NO PAGINATION, AND THAT IS A DECISION
// ============================================================================
//
// The result set has a STRUCTURAL ceiling, not a hoped-for one:
//
//   @@unique([userId, dayDate, portion]) -> at most one row per portion per day
//   |EntryPortion| = 3                   -> at most 3 rows per day
//   366 days in a leap year              -> at most 1098 rows, ever
//
// Nothing a client, a user or a malformed batch can do exceeds it. Note that
// the prompt's "about 260 working days" is the TYPICAL count and not the bound:
// ABSENT is a kind, so a diligent reader can declare all 366 calendar days; and
// a user who switches granularity mid-year leaves FULL rows beside AM/PM ones,
// which is why the per-day ceiling is 3 rather than 1.
//
// WHY A CURSOR WOULD BE WRONG HERE, not merely unnecessary. The client
// reconciles a SET. A half-fetched year is indistinguishable from a year with
// missing days - and "which days are missing" is the one fact this product
// exists to report honestly. A snapshot that arrives whole or fails cannot lie
// about completeness; a paged feed that stops on page three renders as a year
// the user did not live.
//
// SO THE SERVER NEVER TRUNCATES. A short array never carries a 200. If a year
// cannot be served whole the answer is an error, not a partial success.
//
// THE ENVELOPE IS AN OBJECT, NEVER A BARE ARRAY, and that is the one part with
// no recovery at any price: a top-level array can never gain a sibling key. If
// the ceiling ever moves, `nextCursor` can be added beside `entries` and old
// clients keep working.

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { fromStoredDay, toStoredDay } from '@/lib/entries/day';

/**
 * Every field on the wire, in the order the document lists them.
 *
 * THE TEST READS THIS LIST; THE ROUTE DOES NOT BUILD FROM IT. One home for the
 * field names (R206), so the document, the census and the serialiser cannot
 * drift apart without something going red.
 */
export const ENTRY_READ_FIELDS = [
  'id',
  'clientMutationId',
  'dayDate',
  'portion',
  'kind',
  'absenceReason',
  'note',
  'provenance',
  'detectedKind',
  'detectedAt',
  'clientClaimedAt',
  'firstRecordedAt',
  'lastModifiedAt',
] as const;

/**
 * Columns deliberately NOT on the wire.
 *
 * ASSERTED, NOT MERELY ABSENT (R206's corollary). `userId` is the caller's own
 * and adding it would be redundant; `updatedAt` is superseded by
 * `lastModifiedAt` below. A census test requires this list to account for every
 * Entry column that ENTRY_READ_FIELDS does not, so a column added next year
 * cannot join the contract by accident - nor be dropped from it silently.
 */
export const ENTRY_NOT_EXPOSED = ['userId', 'updatedAt'] as const;

/**
 * Wire fields that are NOT columns.
 *
 * `lastModifiedAt` is computed from the EntryEvent trail (R215), so the census
 * must not look for a column of that name - and must not let any OTHER invented
 * field hide behind the same exemption. Naming them individually is what keeps
 * the census honest: the exemption is a list, not a rule.
 */
export const ENTRY_DERIVED_FIELDS = ['lastModifiedAt'] as const;

/**
 * The order of `portion` within one day, stated rather than inherited.
 *
 * POSTGRES SORTS AN ENUM BY ITS DECLARATION ORDER, which is a property of the
 * type rather than of this contract - an `ALTER TYPE ... ADD VALUE ... BEFORE`
 * would silently reorder every response. Sorting against a named constant makes
 * the order a decision, and the test asserts this list covers every value the
 * enum has, so adding a fourth portion goes red here rather than sorting itself
 * last by accident.
 */
export const PORTION_ORDER = ['FULL', 'AM', 'PM'] as const;

/** The shape one entry takes on the wire. */
export interface ReadEntry {
  readonly id: string;
  readonly clientMutationId: string;
  readonly dayDate: string;
  readonly portion: string;
  readonly kind: string;
  readonly absenceReason: string | null;
  readonly note: string | null;
  readonly provenance: string;
  readonly detectedKind: string | null;
  readonly detectedAt: string | null;
  readonly clientClaimedAt: string | null;
  readonly firstRecordedAt: string;
  readonly lastModifiedAt: string | null;
}

/**
 * The columns read from the database.
 *
 * AN EXPLICIT ALLOWLIST, NEVER A SPREAD AND NEVER `omit`. This is `.strict()`
 * pointed outward: a column added to Entry next year cannot join the wire
 * contract by accident, and publishing it becomes a deliberate edit to this
 * object. `omit` would have the opposite default - everything ships unless
 * somebody remembers to hide it - which is the wrong way round for a file whose
 * subject is personal data.
 */
const SELECT = {
  id: true,
  clientMutationId: true,
  dayDate: true,
  portion: true,
  kind: true,
  absenceReason: true,
  note: true,
  provenance: true,
  detectedKind: true,
  detectedAt: true,
  clientClaimedAt: true,
  firstRecordedAt: true,
} satisfies Prisma.EntrySelect;

/** An instant on the wire: UTC, `Z`, milliseconds always, or an explicit null. */
function instant(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

const PORTION_RANK = new Map<string, number>(
  PORTION_ORDER.map((portion, index) => [portion, index]),
);

/**
 * The contract's order: day ascending, then FULL, AM, PM.
 *
 * ============================================================================
 * EXPORTED BECAUSE THE ROUTE-LEVEL TEST CANNOT FAIL ON ITS OWN
 * ============================================================================
 *
 * Found by planting `return 0` here and watching all forty tests pass. The
 * reason is that `@@unique([userId, dayDate, portion])` is a btree index on
 * exactly those columns, so Postgres serves the rows ALREADY ordered by portion
 * - measured: rows inserted PM, FULL, AM come back FULL, AM, PM with no sort at
 * all. The route-level assertion was therefore satisfied by the database's index
 * order rather than by the code under test. R171's coincidence, inside the guard
 * written to prevent exactly that.
 *
 * SO THE COMPARATOR IS TESTED DIRECTLY, on input the database did not order.
 *
 * AND IT IS NOT DEAD CODE, which is the question day.ts's ablation asks of any
 * belt-and-braces line. That second pass could never fire - Europe's transitions
 * are at 02:00, never at midnight, so no input could reach it. This one is
 * reachable: index order is a property of the QUERY PLAN, and a planner that
 * chooses a sequential scan plus a sort for a large result has no obligation to
 * break ties by portion. The index makes this usually redundant; it does not
 * make it unreachable.
 *
 * It also buys what PORTION_ORDER exists for: the order is a function of a named
 * constant rather than of the Postgres enum's declaration order, which an
 * `ALTER TYPE ... ADD VALUE ... BEFORE` could silently rearrange.
 */
export function byDayThenPortion(
  left: { dayDate: string; portion: string },
  right: { dayDate: string; portion: string },
): number {
  if (left.dayDate !== right.dayDate) {
    return left.dayDate < right.dayDate ? -1 : 1;
  }

  return (PORTION_RANK.get(left.portion) ?? 0) - (PORTION_RANK.get(right.portion) ?? 0);
}

/**
 * Every entry the caller declared in one calendar year.
 *
 * THE WINDOW IS BUILT FROM `toStoredDay` AND NEVER FROM `startOfParisDay`, and
 * the distinction is the whole reason day.ts has two kinds of function.
 * `dayDate` is a `@db.Date` column holding UTC midnight - a CALENDAR DAY, not
 * an instant - so the bounds must be built the same way the values were.
 * `startOfParisDay('2026-01-01')` is 2025-12-31T23:00:00Z, an instant an hour
 * before the day it names, and comparing it against a date column is comparing
 * two different kinds of thing. It would appear to work, which is worse.
 *
 * INCLUSIVE AT BOTH ENDS, rather than half-open on the next year's first day.
 * A half-open upper bound for ?year=9999 computes 10000-01-01, which is not a
 * four-digit calendar day and throws inside `assertDay` - a 500 on an input
 * this route's own rule accepts. `<= YYYY-12-31` has no such edge.
 */
export async function readYear(userId: string, year: number): Promise<ReadEntry[]> {
  const padded = String(year).padStart(4, '0');

  return readEntriesWhere(prisma, userId, {
    dayDate: {
      gte: toStoredDay(`${padded}-01-01`),
      lte: toStoredDay(`${padded}-12-31`),
    },
  });
}

/**
 * The rows the caller owns matching `where`, serialised for the wire.
 *
 * ============================================================================
 * ONE HOME FOR THE ENTRY SHAPE, BECAUSE TWO ROUTES NOW RETURN IT (R206)
 * ============================================================================
 *
 * FW23's increment 4 built this for the read path alone. R217 gives the WRITE
 * path the same object, so a client can clear SPEC 13.2's pending state without
 * a second request - and the moment two routes return one concept, the shape
 * needs one home or the second copy drifts. A test asserts the two routes
 * return byte-identical objects for the same day, which is the enforcement
 * point rather than this comment.
 *
 * IT TAKES A CLIENT rather than reaching for the module-level `prisma`, so the
 * write path can call it INSIDE its transaction. A snapshot read outside the
 * transaction would be a different moment from the one being reported.
 */
export async function readEntriesWhere(
  client: Prisma.TransactionClient,
  userId: string,
  where: Prisma.EntryWhereInput,
): Promise<ReadEntry[]> {
  const rows = await client.entry.findMany({
    where: { ...where, userId },
    select: SELECT,
    orderBy: { dayDate: 'asc' },
  });

  // THE LAST-MODIFIED FACT IS DERIVED FROM THE TRAIL, NOT FROM `updatedAt`.
  //
  // The operator's ruling (R215), and it was taken against a measurement rather
  // than a guess: on a row nobody has edited, `firstRecordedAt` and `updatedAt`
  // differ by about five milliseconds, because firstRecordedAt is the batch
  // clock taken once at the top of writeEntries while Prisma stamps @updatedAt
  // at query execution - a findMany, a findUnique and an upsert later.
  //
  // SPEC 12 item 5 prints the last-modified timestamp "WHEN DIFFERENT". Backed
  // by updatedAt that fires on EVERY row, and the one thing the column exists
  // to tell a reader - was this day edited? - becomes unreadable in the legal
  // document. Null-when-never-modified is a state a reader can act on.
  //
  // ONE GROUPED QUERY, bounded by the same 1098. EntryEvent.entryId carries no
  // foreign key (R203) and none is needed: the ids come from rows we just read.
  const ids = rows.map((row) => row.id);

  const modifications =
    ids.length === 0
      ? []
      : await client.entryEvent.groupBy({
          by: ['entryId'],
          where: { userId, entryId: { in: ids }, action: 'MODIFIED' },
          _max: { recordedAt: true },
        });

  const lastModified = new Map(
    modifications.map((row) => [row.entryId, row._max.recordedAt ?? null]),
  );

  return rows
    .map((row) => ({
      id: row.id,
      clientMutationId: row.clientMutationId,
      // THE INVERSE OF WHAT WROTE IT. `fromStoredDay` had no production caller
      // before this line; the read path is where it first earns its place.
      dayDate: fromStoredDay(row.dayDate),
      portion: row.portion,
      kind: row.kind,
      absenceReason: row.absenceReason,
      note: row.note,
      provenance: row.provenance,
      detectedKind: row.detectedKind,
      detectedAt: instant(row.detectedAt),
      clientClaimedAt: instant(row.clientClaimedAt),
      firstRecordedAt: row.firstRecordedAt.toISOString(),
      lastModifiedAt: instant(lastModified.get(row.id) ?? null),
    }))
    .sort(byDayThenPortion);
}
