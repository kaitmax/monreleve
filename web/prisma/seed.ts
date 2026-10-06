// web/prisma/seed.ts
//
// `pnpm db:seed`. Local work only.
//
// WHAT IT IS FOR. The confirm page, the unsubscribe page and the capture card
// all render differently depending on the state of a row, and developing them
// against an empty table means creating that state by hand every time the
// database is reset. FW21 adds the demo year, which is the same idea one
// layer up: the calendar, the dossier and the tiles cannot be developed
// against an empty Entry table.
//
// WHAT IT IS NOT FOR. There is no production path that runs this, and it
// refuses to run against anything but a local database - see the guard below.
// Seeding a real alert list with invented addresses would put mail on its way
// to people who never asked for it.
//
// THE ADDRESSES ARE example.com ON PURPOSE. RFC 2606 reserves it precisely so
// that test data cannot reach a real mailbox; a typo in a domain nobody owns
// is a bounce, and a typo in a real one is a stranger receiving our email.
//
// ===========================================================================
// THE DEMO YEAR IS A FIXTURE, NOT DECORATION (AC3)
// ===========================================================================
//
// FW24 (the dossier), FW25 and FW27 assert against it, so its shape is part of
// the contract and changing it breaks tests three tasks away. Everything below
// is DETERMINISTIC: a fixed year, fixed timestamps, no Date.now(). Two runs
// produce the same database.
//
// THE FIXTURE IS THE RULE, NOT THE NUMBERS. The year is generated from the
// rule stated here, and the totals are PRINTED at the end of the run rather
// than written down in this comment. A derived figure typed into a header is
// the R163 defect - it is a value from a fixture, restated where nothing
// checks it, and it goes stale the first time the rule moves while every test
// stays green.
//
// THE RULE
//   - every weekday of DEMO_YEAR gets an entry, except the one gap below;
//   - Tuesdays and Thursdays are telework (HOME), everything else is CH;
//   - the named days below override that, and are the reason the file exists.
//
// THE DEMO PERSON EXCEEDS THE FISCAL CEILING, AND THAT IS DELIBERATE.
//
// Measured on this fixture: declarableRate 42,70 against a 40 % ceiling,
// remainingToFiscal -6,5 days, warnings FISCAL_CEILING_EXCEEDED and
// A1_REQUIRED. Two of the engine's eight warning codes, live.
//
// DO NOT "TIDY" THE DEMO PERSON INTO COMPLIANCE. A fixture that never crossed
// would leave the exceeded path exercised only by unit tests written for it -
// which is exactly what R222 had to fix for the trail eras, one module over. A
// dossier that renders a breach wrongly is the failure this fixture exists to
// catch, and it cannot catch it against a person who never breaches.
//
// THE NAMED DAYS - each one is a case that has caught a defect before
//
//   gap                 a working day with NO entry at all. "Non renseigne"
//                       and "declared absent" are different facts and the
//                       dossier shows them differently; a fixture with no gap
//                       lets a renderer conflate them and stay green.
//   late                recorded more than seven days after the day itself,
//                       so the "saisie tardive" flag has something to mark.
//   onTime              recorded the same evening - the flag's other side,
//                       without which a renderer that flags everything passes.
//   offlineSync         clientClaimedAt EARLIER than firstRecordedAt. SPEC 8
//                       requires the dossier to show both; a fixture where
//                       they always agree cannot tell a renderer that reads
//                       the wrong one from one that reads the right one.
//   detectedConfirmed   a proposal the reader accepted unchanged.
//   detectedCorrected   a proposal the reader overrode. detectedKind survives
//                       on the row - SPEC 8 makes deleting it a review
//                       rejection.
//   editedAfterwards    created MANUAL as CH, later corrected to HOME. The
//                       ENTRY says HOME (latest wins) and the append-only
//                       trail still holds the CH it superseded. Two events.
//   halfDay             AM in Switzerland, PM at home, on one date.
//   absences            one of each AbsenceReason. They never reach the
//                       engine - SPEC 8 filters them before counting.
//   missions            MISSION_FR and MISSION_THIRD, one each.
//
// R120 - TWO DERIVATIONS OF THE SAME FIGURE DISAGREE, BY CONSTRUCTION
//
// The FW12 tile defect is the precedent: a figure that two code paths compute
// differently, in a fixture where both happened to give the same answer, so
// the test passed using the wrong one.
//
// This year is built so they cannot agree:
//
//   telework ROWS   vs  telework DAYS
//        differ because the half-day pair contributes one HOME row and half a
//        telework day. Anything counting rows is off by 0.5 and will say so.
//
//   total ENTRIES   vs  worked DAYS
//        differ because the absences are entries and are not worked days.
//        Anything using the row count as a denominator is wrong by exactly
//        the number of absences.
//
// Both pairs are printed at the end of every run, side by side, with the gap
// between them. A later test that picks the wrong derivation gets a different
// number rather than a lucky match.

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { AbsenceReason, EntryKind, EntryPortion, Provenance } from '@prisma/client';

const DAY = 24 * 60 * 60 * 1000;

/**
 * The demo year, fixed.
 *
 * NOT `new Date().getFullYear()`. A fixture whose contents depend on when it
 * is run is a fixture that cannot be asserted against: FW24's expected dossier
 * would change on 1 January, and the test that broke would look like a code
 * defect. R171 permits a literal where the value IS the assertion, and this is
 * that case.
 */
const DEMO_YEAR = 2026;

const DEMO_EMAIL = 'demo@example.com';

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function at(iso: string): Date {
  return new Date(`${iso}Z`);
}

function isWeekday(date: Date): boolean {
  const weekday = date.getUTCDay();

  return weekday !== 0 && weekday !== 6;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type Named = {
  readonly date: string;
  readonly kind: EntryKind;
  readonly portion?: EntryPortion;
  readonly provenance?: Provenance;
  readonly detectedKind?: EntryKind;
  readonly detectedAt?: string;
  readonly absenceReason?: AbsenceReason;
  readonly clientClaimedAt?: string;
  readonly firstRecordedAt?: string;
  readonly note?: string;
};

/**
 * The day with no entry. Named separately because its whole point is that
 * nothing is written for it, which a list of entries cannot express.
 */
/**
 * Where the modern era of the trail begins. R222.
 *
 * ============================================================================
 * A REAL DATABASE ON THIS DATE HAS BOTH ERAS, SO THE FIXTURE DOES TOO
 * ============================================================================
 *
 * R219 gave EntryEvent a `clientMutationId` and could not backfill it: the id
 * on a legacy event's Entry is the LAST write's, not the one that created it,
 * so filling it in would write a falsehood into an append-only table.
 *
 * That leaves every real database looking like this one - a long stretch
 * written before the migration whose events carry no id, and a recent stretch
 * written through the API since, whose events do. A uniformly-legacy fixture is
 * as unrealistic as a uniformly-modern one, and only the mixed version
 * exercises BOTH duplicate-detection paths: the trail for modern ids, and the
 * Entry fallback for legacy ones.
 *
 * THE CUTOFF IS DECEMBER because every named day sits before it - the late day,
 * the offline day, the half-day pair, the absences, and the EDITED day at
 * 2026-07-07. The edit is the one that matters: it is R219's exact scenario, so
 * keeping it legacy means the fallback is exercised against a row whose
 * `Entry.clientMutationId` has already been overwritten by a later mutation.
 *
 * NOT WRITTEN THROUGH writeEntries, though that would make this seed a consumer
 * of the contract rather than a second implementation of it, which is the
 * better shape. The write path takes the SERVER CLOCK for `firstRecordedAt`,
 * and this fixture is pinned to 2026: run the seed in 2027 and every modern row
 * would be recorded a year after the day it describes, so the late flag would
 * fire across the whole stretch and the scenario would say something it does
 * not mean. A fixture whose meaning changes with the date is what R197 forbids.
 * So the id is carried in ONE variable and both columns are set from it - see
 * `clientMutationId` below, which is read rather than re-derived.
 */
const MODERN_TRAIL_FROM = '2026-12-01';

const GAP = '2026-06-17';

const NAMED: readonly Named[] = [
  {
    // Recorded 23 days after the fact. firstRecordedAt - dayDate > 7 days, so
    // the late flag is derived rather than stored.
    date: '2026-02-10',
    kind: 'HOME',
    firstRecordedAt: '2026-03-05T09:41:00.000',
    note: 'saisie tardive',
  },
  {
    // The same evening. The flag's other side.
    date: '2026-02-11',
    kind: 'CH',
    firstRecordedAt: '2026-02-11T18:12:00.000',
  },
  {
    // Detection proposed Switzerland and the reader accepted it.
    date: '2026-03-18',
    kind: 'CH',
    provenance: 'DETECTED_CONFIRMED',
    detectedKind: 'CH',
    detectedAt: '2026-03-18T17:55:00.000',
  },
  {
    // Detection proposed Switzerland and the reader said home. BOTH stay on
    // the row - deleting the overridden proposal is a review rejection.
    date: '2026-03-17',
    kind: 'HOME',
    provenance: 'DETECTED_CORRECTED',
    detectedKind: 'CH',
    detectedAt: '2026-03-17T17:48:00.000',
  },
  {
    // Written offline on the day, reached the server five days later. The
    // dossier shows both timestamps.
    date: '2026-05-20',
    kind: 'HOME',
    clientClaimedAt: '2026-05-20T18:03:00.000',
    firstRecordedAt: '2026-05-25T09:12:00.000',
  },
  {
    // Created as CH, corrected to HOME afterwards. The entry says HOME; the
    // trail still holds the CH. Two events - see EDITED_ORIGINAL below.
    date: '2026-07-07',
    kind: 'HOME',
    note: 'corrige apres coup',
  },
  // The half-day pair: morning in Geneva, afternoon at home.
  { date: '2026-04-14', kind: 'CH', portion: 'AM' },
  { date: '2026-04-14', kind: 'HOME', portion: 'PM' },
  // One absence of each reason.
  { date: '2026-08-10', kind: 'ABSENT', absenceReason: 'CONGE' },
  { date: '2026-11-03', kind: 'ABSENT', absenceReason: 'MALADIE' },
  { date: '2026-05-01', kind: 'ABSENT', absenceReason: 'FERIE' },
  { date: '2026-09-28', kind: 'ABSENT', absenceReason: 'AUTRE' },
  // The two mission kinds.
  { date: '2026-06-02', kind: 'MISSION_FR' },
  { date: '2026-10-06', kind: 'MISSION_THIRD' },
];

/** What 2026-07-07 was before the reader corrected it. */
const EDITED_ORIGINAL: { readonly date: string; readonly kind: EntryKind } = {
  date: '2026-07-07',
  kind: 'CH',
};

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set; copy web/.env.example to web/.env.');
  }

  // THE GUARD. A seed script is a data-writing command with a friendly name,
  // and the cost of running it against the wrong database is other people's
  // email addresses in a table beside four invented ones. Local hosts only,
  // and it says what it refused rather than failing obscurely.
  const host = new URL(url).hostname;

  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    throw new Error(
      `Refusing to seed a non-local database (host: ${host}). This script ` +
        'exists for development and there is no production path that runs it.',
    );
  }

  return url;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: connectionString() }),
});

async function seedAlertSubscribers(): Promise<number> {
  // Idempotent: the seed is run repeatedly during development, and a unique
  // constraint failure on the second run would read as a broken script.
  await prisma.alertSubscriber.deleteMany({
    where: { email: { endsWith: '@example.com' } },
  });

  const now = Date.now();

  await prisma.alertSubscriber.createMany({
    data: [
      {
        // Waiting for the reader to click the link in their email.
        email: 'en-attente@example.com',
        source: 'calculateur',
        confirmationTokenHash: 'seed-unconfirmed-token-hash',
        confirmationExpiresAt: new Date(now + 7 * DAY),
      },
      {
        // On the list. The ordinary case.
        email: 'confirme@example.com',
        source: 'alertes',
        confirmedAt: new Date(now - 30 * DAY),
      },
      {
        // Was on the list and left. The row is kept so that re-subscribing is
        // a decision the record can show.
        email: 'desinscrit@example.com',
        source: 'guide',
        confirmedAt: new Date(now - 60 * DAY),
        unsubscribedAt: new Date(now - 2 * DAY),
      },
      {
        // Old enough for the thirty-day purge to take it (FW14 increment 6),
        // so that job can be watched working against real data.
        email: 'perime@example.com',
        source: 'calculateur',
        createdAt: new Date(now - 31 * DAY),
        confirmationTokenHash: 'seed-expired-token-hash',
        confirmationExpiresAt: new Date(now - 24 * DAY),
      },
    ],
  });

  return prisma.alertSubscriber.count();
}

/**
 * Every weekday of the demo year, in order.
 */
function weekdays(): Date[] {
  const days: Date[] = [];

  for (
    let cursor = day(`${DEMO_YEAR}-01-01`);
    cursor.getUTCFullYear() === DEMO_YEAR;
    cursor = new Date(cursor.getTime() + DAY)
  ) {
    if (isWeekday(cursor)) {
      days.push(new Date(cursor));
    }
  }

  return days;
}

/**
 * Refuse to seed a year whose named days do not mean what they say.
 *
 * A special case written on a Sunday is not a special case - it is a row the
 * calendar will not render and no test will miss, because the assertion it
 * was written for still passes on the other rows. R154's shape: the mechanism
 * is proven to deliver rather than proven not to fail.
 */
function checkNamedDays(): void {
  const dates = [GAP, ...NAMED.map((named) => named.date)];

  for (const date of dates) {
    const parsed = day(date);

    if (parsed.getUTCFullYear() !== DEMO_YEAR) {
      throw new Error(`${date} is not in the demo year ${DEMO_YEAR}.`);
    }

    if (!isWeekday(parsed)) {
      throw new Error(
        `${date} falls on a weekend, so the case written for it would never ` +
          'appear among the working days the fixture generates.',
      );
    }
  }

  const pair = NAMED.filter((named) => named.portion !== undefined);

  if (pair.length !== 2 || pair[0]?.date !== pair[1]?.date) {
    throw new Error('the half-day pair must be exactly two portions of one date.');
  }

  const reasons = new Set(
    NAMED.filter((named) => named.kind === 'ABSENT').map((named) => named.absenceReason),
  );

  if (reasons.size !== 4) {
    throw new Error(`expected one absence of each reason; found ${reasons.size}.`);
  }
}

type Built = {
  userId: string;
  dayDate: Date;
  portion: EntryPortion;
  kind: EntryKind;
  absenceReason: AbsenceReason | null;
  clientMutationId: string;
  note: string | null;
  provenance: Provenance;
  detectedKind: EntryKind | null;
  detectedAt: Date | null;
  clientClaimedAt: Date | null;
  firstRecordedAt: Date;
};

function buildEntries(userId: string): Built[] {
  const named = new Map<string, Named[]>();

  for (const entry of NAMED) {
    named.set(entry.date, [...(named.get(entry.date) ?? []), entry]);
  }

  const built: Built[] = [];

  for (const date of weekdays()) {
    const key = iso(date);

    if (key === GAP) {
      continue;
    }

    const overrides = named.get(key);

    if (overrides !== undefined) {
      for (const override of overrides) {
        const portion = override.portion ?? 'FULL';

        built.push({
          userId,
          dayDate: date,
          portion,
          kind: override.kind,
          absenceReason: override.absenceReason ?? null,
          clientMutationId: `demo-${key}-${portion}`,
          note: override.note ?? null,
          provenance: override.provenance ?? 'MANUAL',
          detectedKind: override.detectedKind ?? null,
          detectedAt: override.detectedAt === undefined ? null : at(override.detectedAt),
          clientClaimedAt:
            override.clientClaimedAt === undefined ? null : at(override.clientClaimedAt),
          firstRecordedAt:
            override.firstRecordedAt === undefined
              ? at(`${key}T18:00:00.000`)
              : at(override.firstRecordedAt),
        });
      }

      continue;
    }

    // THE RULE: Tuesdays and Thursdays at home, the rest in Switzerland.
    const weekday = date.getUTCDay();
    const kind: EntryKind = weekday === 2 || weekday === 4 ? 'HOME' : 'CH';

    // AND THE ORDINARY DAY IS DETECTED, because the person this fixture
    // describes turned detection on. See ordinaryDaysAgreeWithTheSettings.
    built.push({
      userId,
      dayDate: date,
      portion: 'FULL',
      kind,
      absenceReason: null,
      clientMutationId: `demo-${key}-FULL`,
      note: null,
      provenance: 'DETECTED_CONFIRMED',
      detectedKind: kind,
      detectedAt: at(`${key}T17:52:00.000`),
      clientClaimedAt: null,
      firstRecordedAt: at(`${key}T18:00:00.000`),
    });
  }

  return built;
}

async function seedDemoYear(): Promise<void> {
  checkNamedDays();

  // Idempotent, and it uses the ONE delete the append-only trigger permits:
  // removing the person removes their entries and events together (D11).
  // There is no other way to empty EntryEvent, which is the point.
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      emailVerified: at(`${DEMO_YEAR}-01-02T09:00:00.000`),
      name: 'Demo',
      canton: 'GE',
      employmentRate: 100,
      denominatorKind: 'SIMPLIFIED240',
      // HALF_DAY because the fixture contains a half-day pair, and AM/PM are
      // only legal when the person logs that way (D9).
      granularity: 'HALF_DAY',
      loggingMode: 'AUTO_DETECT',
      detectionConsentAt: at(`${DEMO_YEAR}-01-02T09:05:00.000`),
      activityStartDate: day(`${DEMO_YEAR}-01-01`),
      reminderTime: '17:30',
      reminderEnabled: true,
    },
  });

  const entries = buildEntries(user.id);

  ordinaryDaysAgreeWithTheSettings(user.loggingMode, entries);

  await prisma.entry.createMany({ data: entries });

  const stored = await prisma.entry.findMany({
    where: { userId: user.id },
    orderBy: [{ dayDate: 'asc' }, { portion: 'asc' }],
  });

  // THE TRAIL. One CREATED event per entry, recorded when the server first
  // heard about the day - so recordedAt agrees with firstRecordedAt rather
  // than being invented here.
  await prisma.entryEvent.createMany({
    data: stored.map((entry) => ({
      userId: entry.userId,
      entryId: entry.id,
      action: 'CREATED' as const,
      // The edited day was created as something else, and the trail is where
      // that survives. Everything else was created as what it still is.
      kind: entry.dayDate.toISOString().startsWith(EDITED_ORIGINAL.date)
        ? EDITED_ORIGINAL.kind
        : entry.kind,
      provenance: entry.provenance,
      detectedKind: entry.detectedKind,
      dayDate: entry.dayDate,
      portion: entry.portion,
      recordedAt: entry.firstRecordedAt,
      clientClaimedAt: entry.clientClaimedAt,
      // R222: ONE ID PER MUTATION, ONE VARIABLE. Read from the row rather than
      // rebuilt from the same template, so the trail cannot disagree with the
      // entry it records - a second derivation of one value is the defect R181
      // names, and it would be invisible here because both would look right.
      clientMutationId:
        iso(entry.dayDate) >= MODERN_TRAIL_FROM ? entry.clientMutationId : null,
    })),
  });

  const edited = stored.find((entry) =>
    entry.dayDate.toISOString().startsWith(EDITED_ORIGINAL.date),
  );

  if (edited === undefined) {
    throw new Error(`the edited day ${EDITED_ORIGINAL.date} is not among the seeded entries.`);
  }

  await prisma.entryEvent.create({
    data: {
      userId: edited.userId,
      entryId: edited.id,
      action: 'MODIFIED',
      kind: edited.kind,
      provenance: edited.provenance,
      detectedKind: edited.detectedKind,
      dayDate: edited.dayDate,
      portion: edited.portion,
      recordedAt: at(`${EDITED_ORIGINAL.date}T21:14:00.000`),
      clientClaimedAt: edited.clientClaimedAt,
    },
  });

  await report(user.id, stored);
}

/**
 * Refuse a year that contradicts the person it belongs to.
 *
 * THE WALKTHROUGH FOUND THIS, and nothing else could have. The first version
 * gave the demo user loggingMode AUTO_DETECT with consent recorded on 2
 * January, and then wrote 259 of 261 days as MANUAL: a person who switched
 * detection on and typed every day by hand for a year. Both halves were
 * internally consistent - the settings were valid, every entry was valid, and
 * every test passed - and the contradiction existed only BETWEEN them, which
 * is the shape R172 was written for, one subject over.
 *
 * It matters because the fixture is what FW24, FW25 and FW27 render. SPEC 8
 * requires provenance shown in the calendar cell, the edit sheet, the annex,
 * the CSV and the PDF; against 259 identical MANUAL rows, a renderer that
 * ignored provenance entirely would have looked very nearly right.
 *
 * THE RULE IT ENFORCES: detection knows where the phone was, not why somebody
 * was away. So an absence is never detected, and a person with detection
 * switched on has proposals on most of their ordinary days.
 */
function ordinaryDaysAgreeWithTheSettings(
  loggingMode: 'MANUAL' | 'AUTO_DETECT',
  entries: Built[],
): void {
  const detectedAbsence = entries.find(
    (entry) => entry.kind === 'ABSENT' && entry.detectedKind !== null,
  );

  if (detectedAbsence !== undefined) {
    throw new Error(
      `${iso(detectedAbsence.dayDate)} is an absence carrying a detected kind. ` +
        'Detection knows which country the phone was in; it cannot propose ' +
        'a reason somebody was away.',
    );
  }

  if (loggingMode !== 'AUTO_DETECT') {
    return;
  }

  const worked = entries.filter((entry) => entry.kind !== 'ABSENT');
  const proposed = worked.filter((entry) => entry.detectedKind !== null);

  if (proposed.length * 2 <= worked.length) {
    throw new Error(
      `the demo person has detection switched on and only ${proposed.length} of ` +
        `${worked.length} worked days carry a proposal. That is a year that ` +
        'contradicts its own settings, and it is what FW24, FW25 and FW27 ' +
        'would render.',
    );
  }
}

/**
 * Print the shape, and print R120's two pairs side by side.
 *
 * COMPUTED HERE, NEVER TYPED IN THE HEADER. A derived figure written into a
 * comment is a value from a fixture restated where nothing checks it - it goes
 * stale the first time the rule moves, with every test still green (R163).
 */
async function report(userId: string, stored: { kind: EntryKind; portion: EntryPortion }[]): Promise<void> {
  const half = (portion: EntryPortion): number => (portion === 'FULL' ? 1 : 0.5);

  const teleworkRows = stored.filter((entry) => entry.kind === 'HOME').length;
  const teleworkDays = stored
    .filter((entry) => entry.kind === 'HOME')
    .reduce((total, entry) => total + half(entry.portion), 0);

  const totalEntries = stored.length;
  const workedDays = stored
    .filter((entry) => entry.kind !== 'ABSENT')
    .reduce((total, entry) => total + half(entry.portion), 0);

  const events = await prisma.entryEvent.count({ where: { userId } });

  console.log(`seeded: the ${DEMO_YEAR} demo year for ${DEMO_EMAIL}`);
  console.log(`  entries ${totalEntries}, events ${events}, one working day with no entry (${GAP})`);
  console.log('');
  console.log('  R120 - two derivations of one figure, and they disagree:');
  console.log(`    telework ROWS  ${teleworkRows}      telework DAYS  ${teleworkDays}`);
  console.log(`      -> a count of rows is off by ${teleworkRows - teleworkDays} (the half-day pair)`);
  console.log(`    total ENTRIES  ${totalEntries}      worked DAYS    ${workedDays}`);
  console.log(`      -> a row count as denominator is off by ${totalEntries - workedDays} (absences, half-days)`);

  if (teleworkRows === teleworkDays || totalEntries === workedDays) {
    throw new Error(
      'the two derivations agree, so this fixture cannot catch a test that ' +
        'uses the wrong one. That is the FW12 tile defect (R120) and the seed ' +
        'refuses to produce it.',
    );
  }
}

// ===========================================================================
// SEED-RELEVE: THREE SCENARIO ACCOUNTS, A REAL YEAR OF DATA TO SEE THE RELEVE
// ===========================================================================
//
// The demo year above is a FIXTURE: fixed, deterministic, asserted against by
// FW24/25/27 and demo-year.test.ts. These three accounts are a DEMONSTRATION:
// two years of realistic data (2025 complete, 2026 to yesterday) a person can
// open on the phone and read as a releve. They are SEPARATE from demo@example.com
// so the fixture stays frozen (R273/R206) - this file extends the seed, it does
// not rewrite it.
//
// WHY A DIRECT SEED, NOT THE API. The server stamps firstRecordedAt on receipt.
// A year posted through the API today would be stamped today, so every day would
// read "saisie tardive". Writing straight to the database is the only way to give
// each day a server timestamp that falls when a real person would have recorded
// it - most the same evening, some a few days later, a few genuinely late - with
// an EntryEvent trail that matches (the append-only triggers refuse UPDATE and
// DELETE, never INSERT).
//
// CLOCK-DEPENDENT BY DESIGN, UNLIKE THE DEMO YEAR. "2026 to yesterday" moves
// every day, so these accounts read `new Date()`; the demo year does not and
// stays pinned. R197: every timestamp is in the PAST - no entry is dated today or
// later, and every recorded/event stamp is clamped strictly before the seed run.
//
// THE ADDRESSES ARE .invalid ON PURPOSE. RFC 6761 reserves it so test data can
// never reach a real mailbox; these are people who do not exist.

const MINUTE = 60 * 1000;

/** The .invalid domain can never deliver - these accounts are not real people. */
const CAMILLE_EMAIL = 'camille.martin@example.invalid';
const ALEX_EMAIL = 'alex.dupont@example.invalid';
const SAM_EMAIL = 'sam.bernard@example.invalid';

/** UTC midnight of a Date. */
function midnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}

/** No day is after yesterday (R197). The cutoff is yesterday's UTC midnight. */
function yesterday(): Date {
  return addDays(midnight(new Date()), -1);
}

/** No stamp is after the seed run (R197). A minute of slack keeps it strictly past. */
function clampPast(date: Date): Date {
  const ceiling = Date.now() - MINUTE;

  return date.getTime() > ceiling ? new Date(ceiling) : date;
}

/** The ISO day of the nth (1-based) `weekday` (0=Sun..6=Sat) in a month (1-based). */
function weekdayDate(year: number, month1: number, nth: number, weekday: number): string {
  let seen = 0;

  for (let d = 1; d <= 31; d += 1) {
    const date = new Date(Date.UTC(year, month1 - 1, d));

    if (date.getUTCMonth() !== month1 - 1) break;

    if (date.getUTCDay() === weekday) {
      seen += 1;

      if (seen === nth) return iso(date);
    }
  }

  throw new Error(`no ${nth}th weekday ${weekday} in ${year}-${month1}`);
}

/** Easter Sunday, Meeus/Jones/Butcher (Gregorian). Returns a UTC-midnight Date. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const dayOfMonth = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, dayOfMonth));
}

/** Jeûne genevois: the Thursday after the first Sunday of September. */
function jeuneGenevois(year: number): string {
  for (let d = 1; d <= 7; d += 1) {
    const sunday = new Date(Date.UTC(year, 8, d));

    if (sunday.getUTCDay() === 0) return iso(addDays(sunday, 4));
  }

  throw new Error(`no first Sunday of September in ${year}`);
}

/**
 * Geneva's nine legal public holidays for a year, those falling on a weekday.
 *
 * Four move with Easter (Good Friday, Easter Monday, Ascension, Whit Monday);
 * the Jeûne genevois is the Thursday after the first Sunday of September; the
 * rest are fixed. A holiday on a weekend produces no weekday entry, so it is
 * dropped here rather than written as an absence nobody would record.
 */
function genevaHolidayWeekdays(year: number): string[] {
  const easter = easterSunday(year);

  const all = [
    `${year}-01-01`, // Nouvel An
    iso(addDays(easter, -2)), // Vendredi saint
    iso(addDays(easter, 1)), // Lundi de Paques
    iso(addDays(easter, 39)), // Ascension
    iso(addDays(easter, 50)), // Lundi de Pentecote
    `${year}-08-01`, // Fete nationale
    jeuneGenevois(year), // Jeune genevois
    `${year}-12-25`, // Noel
    `${year}-12-31`, // Restauration de la Republique
  ];

  return all.filter((d) => isWeekday(day(d)));
}

/** Monday to Friday of the week beginning at a Monday ISO day. */
function congeWeek(mondayIso: string): string[] {
  return [0, 1, 2, 3, 4].map((offset) => iso(addDays(day(mondayIso), offset)));
}

/**
 * One planned entry, before it is written. editedFrom carries the value the day
 * was FIRST recorded as, so the trail can show the change the row no longer does.
 */
interface Plan {
  readonly date: string;
  readonly portion: EntryPortion;
  readonly kind: EntryKind;
  readonly absenceReason: AbsenceReason | null;
  readonly provenance: Provenance;
  readonly detectedKind: EntryKind | null;
  readonly detectedAt: Date | null;
  readonly clientClaimedAt: Date | null;
  readonly firstRecordedAt: Date;
  readonly editedFrom: EntryKind | null;
  readonly editedAt: Date | null;
}

/** An override for one date: a special kind, a recording delay, an edit, a split. */
interface Override {
  readonly kind?: EntryKind;
  readonly absenceReason?: AbsenceReason;
  readonly provenance?: Provenance;
  readonly detectedKind?: EntryKind;
  /** Days between the day itself and firstRecordedAt (late, or merely a few days). */
  readonly recordedOffsetDays?: number;
  /** The day was written offline on the day and reached the server later. */
  readonly offline?: boolean;
  /** The value the day was first recorded as; `kind` is the correction. */
  readonly editedFrom?: EntryKind;
  /** A half-day split: [AM kind, PM kind]. Requires HALF_DAY granularity. */
  readonly split?: readonly [EntryKind, EntryKind];
}

interface YearPlan {
  readonly start: string;
  readonly end: string;
  readonly defaultKind: (isoDay: string) => EntryKind;
  readonly detection: boolean;
  readonly consentIso: string | null;
  readonly overrides: ReadonlyMap<string, Override>;
  readonly gaps: ReadonlySet<string>;
}

const weekIndexOf = (isoDay: string): number => {
  const date = day(isoDay);
  const firstOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.round((date.getTime() - firstOfYear) / DAY);

  return Math.floor(dayOfYear / 7);
};

/** Insert into a map only if the key is free - first category wins (priority). */
function putIfFree(map: Map<string, Override>, dates: readonly string[], value: Override): void {
  for (const date of dates) {
    if (!map.has(date)) map.set(date, value);
  }
}

/** Build the ordinary-day entry (or half-day pair) for one date under a plan. */
function planDay(isoDay: string, cfg: YearPlan): Plan[] {
  const override = cfg.overrides.get(isoDay);

  const eveningOf = (d: string): Date => at(`${d}T18:00:00.000`);

  if (override?.split !== undefined) {
    // A half-day pair: morning one place, afternoon another. Manual, same evening.
    const recordedAt = clampPast(eveningOf(isoDay));

    return (['AM', 'PM'] as const).map((portion, index) => ({
      date: isoDay,
      portion,
      kind: override.split![index]!,
      absenceReason: null,
      provenance: 'MANUAL' as Provenance,
      detectedKind: null,
      detectedAt: null,
      clientClaimedAt: null,
      firstRecordedAt: recordedAt,
      editedFrom: null,
      editedAt: null,
    }));
  }

  const kind = override?.kind ?? cfg.defaultKind(isoDay);
  const absent = kind === 'ABSENT';
  const absenceReason = absent ? (override?.absenceReason ?? 'AUTRE') : null;

  let provenance: Provenance = 'MANUAL';
  let detectedKind: EntryKind | null = null;
  let detectedAt: Date | null = null;

  if (!absent) {
    if (override?.provenance !== undefined) {
      provenance = override.provenance;
      detectedKind = override.detectedKind ?? null;
      detectedAt = detectedKind === null ? null : at(`${isoDay}T17:50:00.000`);
    } else if (cfg.detection && cfg.consentIso !== null && isoDay >= cfg.consentIso) {
      provenance = 'DETECTED_CONFIRMED';
      detectedKind = kind;
      detectedAt = at(`${isoDay}T17:50:00.000`);
    }
  }

  const offset = override?.recordedOffsetDays ?? 0;
  const firstRecordedAt = clampPast(
    offset === 0 ? eveningOf(isoDay) : at(`${iso(addDays(day(isoDay), offset))}T09:12:00.000`),
  );
  const clientClaimedAt = override?.offline === true ? eveningOf(isoDay) : null;

  const editedFrom = override?.editedFrom ?? null;
  const editedAt =
    editedFrom === null ? null : clampPast(at(`${iso(addDays(day(isoDay), 2))}T21:14:00.000`));

  return [
    {
      date: isoDay,
      portion: 'FULL',
      kind,
      absenceReason,
      provenance,
      detectedKind,
      detectedAt,
      clientClaimedAt,
      firstRecordedAt,
      editedFrom,
      editedAt,
    },
  ];
}

/** Every planned entry for a year, in day order, skipping the gaps. */
function planYear(cfg: YearPlan): Plan[] {
  const plans: Plan[] = [];
  const last = day(cfg.end);

  for (
    let cursor = day(cfg.start);
    cursor.getTime() <= last.getTime();
    cursor = addDays(cursor, 1)
  ) {
    if (!isWeekday(cursor)) continue;

    const key = iso(cursor);

    if (cfg.gaps.has(key)) continue;

    plans.push(...planDay(key, cfg));
  }

  return plans;
}

/**
 * Refuse a plan whose settings and entries contradict each other (R202).
 *
 * The seed for the demo year found this exact class once: AUTO_DETECT with a
 * year of MANUAL days. Here the risk is the opposite - a detected day before the
 * consent that made detection legal - so that is what this checks, plus the rule
 * that an absence is never detected (detection knows a country, not a reason).
 */
function plansAgreeWithSettings(
  email: string,
  consentAt: Date | null,
  plans: readonly Plan[],
): void {
  for (const plan of plans) {
    if (plan.provenance === 'MANUAL') continue;

    if (plan.kind === 'ABSENT') {
      throw new Error(`${email}: ${plan.date} is a detected absence; detection cannot propose a reason.`);
    }

    if (consentAt === null) {
      throw new Error(`${email}: ${plan.date} is detected but the account never gave consent.`);
    }

    if (day(plan.date).getTime() < midnight(consentAt).getTime()) {
      throw new Error(`${email}: ${plan.date} is detected before consent on ${iso(consentAt)}.`);
    }
  }
}

interface ScenarioUser {
  readonly email: string;
  readonly name: string;
  readonly granularity: 'DAY' | 'HALF_DAY';
  readonly loggingMode: 'MANUAL' | 'AUTO_DETECT';
  readonly detectionConsentAt: Date | null;
  readonly activityStartDate: Date;
}

/** Create the person and write their planned years, with a matching event trail. */
async function seedScenarioAccount(who: ScenarioUser, plans: readonly Plan[]): Promise<void> {
  plansAgreeWithSettings(who.email, who.detectionConsentAt, plans);

  // Idempotent, and it uses the one delete the append-only trigger permits:
  // removing the person removes their entries and events together (D11).
  await prisma.user.deleteMany({ where: { email: who.email } });

  const tag = who.email.split('@')[0]!;

  const user = await prisma.user.create({
    data: {
      email: who.email,
      emailVerified: clampPast(at(`${iso(who.activityStartDate)}T09:00:00.000`)),
      name: who.name,
      canton: 'GE',
      employmentRate: 100,
      denominatorKind: 'SIMPLIFIED240',
      granularity: who.granularity,
      loggingMode: who.loggingMode,
      detectionConsentAt: who.detectionConsentAt,
      activityStartDate: who.activityStartDate,
      reminderTime: '17:30',
      reminderEnabled: true,
    },
  });

  const byMutationId = new Map<string, Plan>();

  const entryData = plans.map((plan) => {
    const clientMutationId = `${tag}-${plan.date}-${plan.portion}`;

    byMutationId.set(clientMutationId, plan);

    return {
      userId: user.id,
      dayDate: day(plan.date),
      portion: plan.portion,
      kind: plan.kind,
      absenceReason: plan.absenceReason,
      clientMutationId,
      note: null,
      provenance: plan.provenance,
      detectedKind: plan.detectedKind,
      detectedAt: plan.detectedAt,
      clientClaimedAt: plan.clientClaimedAt,
      firstRecordedAt: plan.firstRecordedAt,
    };
  });

  await prisma.entry.createMany({ data: entryData });

  const stored = await prisma.entry.findMany({
    where: { userId: user.id },
    orderBy: [{ dayDate: 'asc' }, { portion: 'asc' }],
  });

  // THE CREATED EVENT, stamped when the server first heard. For an edited day it
  // records the value the day was FIRST recorded as (editedFrom). The mutation id
  // is read from the row (R181/R222); an edited day's events are legacy (null),
  // because Entry.clientMutationId there is the LATER write's.
  await prisma.entryEvent.createMany({
    data: stored.map((entry) => {
      const plan = byMutationId.get(entry.clientMutationId)!;
      const edited = plan.editedFrom !== null;

      return {
        userId: entry.userId,
        entryId: entry.id,
        action: 'CREATED' as const,
        kind: edited ? plan.editedFrom! : entry.kind,
        provenance: entry.provenance,
        detectedKind: entry.detectedKind,
        dayDate: entry.dayDate,
        portion: entry.portion,
        recordedAt: entry.firstRecordedAt,
        clientClaimedAt: entry.clientClaimedAt,
        clientMutationId: edited ? null : entry.clientMutationId,
      };
    }),
  });

  // THE MODIFIED EVENTS, for the days a reader corrected after first recording.
  for (const entry of stored) {
    const plan = byMutationId.get(entry.clientMutationId)!;

    if (plan.editedFrom === null) continue;

    await prisma.entryEvent.create({
      data: {
        userId: entry.userId,
        entryId: entry.id,
        action: 'MODIFIED',
        kind: entry.kind,
        provenance: entry.provenance,
        detectedKind: entry.detectedKind,
        dayDate: entry.dayDate,
        portion: entry.portion,
        recordedAt: plan.editedAt ?? clampPast(addDays(entry.firstRecordedAt, 2)),
        clientClaimedAt: entry.clientClaimedAt,
        clientMutationId: null,
      },
    });
  }

  const events = await prisma.entryEvent.count({ where: { userId: user.id } });
  const edits = plans.filter((plan) => plan.editedFrom !== null).length;
  const late = plans.filter(
    (plan) => plan.firstRecordedAt.getTime() - day(plan.date).getTime() > 7 * DAY,
  ).length;

  console.log(
    `seeded: ${who.email} (${who.name}) - ${stored.length} entries, ${events} events, ` +
      `${edits} edited, ${late} saisie tardive`,
  );
}

/**
 * ACCOUNT 1 - Camille Martin. Geneva, 100 %, simplified 240, whole days. Manual
 * until September 2026, detection (beta) from then. About two telework days a
 * week - comfortably under the 40 % ceiling. Missions, holidays, leave, sick
 * days, late recordings and three corrections, across 2025 (full) and 2026 (to
 * yesterday).
 */
function camilleYear(year: number, start: string, end: string): YearPlan {
  const overrides = new Map<string, Override>();
  const gaps = new Set<string>([
    weekdayDate(year, 3, 4, 3), // a Wednesday in March
    weekdayDate(year, 7, 1, 5), // a Friday in July
    weekdayDate(year, 10, 2, 2), // a Tuesday in October
  ]);

  // Missions first - exact counts are part of the scenario, so they are protected.
  putIfFree(
    overrides,
    [
      weekdayDate(year, 2, 2, 2),
      weekdayDate(year, 3, 2, 2),
      weekdayDate(year, 5, 3, 3),
      weekdayDate(year, 6, 1, 4),
    ],
    { kind: 'MISSION_FR' },
  );
  putIfFree(
    overrides,
    [weekdayDate(year, 1, 3, 4), weekdayDate(year, 4, 2, 3), weekdayDate(year, 6, 3, 2)],
    { kind: 'MISSION_THIRD' },
  );

  // Three sick days.
  for (const date of [weekdayDate(year, 2, 1, 3), weekdayDate(year, 5, 2, 1), weekdayDate(year, 11, 1, 4)]) {
    putIfFree(overrides, [date], { kind: 'ABSENT', absenceReason: 'MALADIE' });
  }

  // The two detected-corrected days (2026 only, after consent).
  if (year === 2026) {
    putIfFree(overrides, [weekdayDate(year, 9, 2, 2)], {
      kind: 'HOME',
      provenance: 'DETECTED_CORRECTED',
      detectedKind: 'CH',
    });
    putIfFree(overrides, [weekdayDate(year, 9, 3, 4)], {
      kind: 'CH',
      provenance: 'DETECTED_CORRECTED',
      detectedKind: 'HOME',
    });
  }

  // Three days corrected after first recording.
  putIfFree(overrides, [weekdayDate(year, 3, 1, 1)], { kind: 'HOME', editedFrom: 'CH' });
  putIfFree(overrides, [weekdayDate(year, 5, 1, 2)], { kind: 'HOME', editedFrom: 'CH' });
  putIfFree(overrides, [weekdayDate(year, 6, 2, 3)], { kind: 'CH', editedFrom: 'HOME' });

  // Geneva public holidays.
  for (const holiday of genevaHolidayWeekdays(year)) {
    putIfFree(overrides, [holiday], { kind: 'ABSENT', absenceReason: 'FERIE' });
  }

  // Five weeks of leave.
  for (const monday of [
    weekdayDate(year, 2, 3, 1),
    weekdayDate(year, 4, 3, 1),
    weekdayDate(year, 7, 2, 1),
    weekdayDate(year, 8, 3, 1),
    weekdayDate(year, 10, 1, 1),
  ]) {
    putIfFree(overrides, congeWeek(monday), { kind: 'ABSENT', absenceReason: 'CONGE' });
  }

  // Five days recorded more than a week late.
  const lateDays: ReadonlyArray<readonly [string, number]> = [
    [weekdayDate(year, 1, 2, 2), 9],
    [weekdayDate(year, 2, 4, 4), 12],
    [weekdayDate(year, 3, 3, 5), 15],
    [weekdayDate(year, 4, 1, 3), 10],
    [weekdayDate(year, 6, 2, 1), 18],
  ];
  for (const [date, offset] of lateDays) {
    putIfFree(overrides, [date], { recordedOffsetDays: offset });
  }

  // A few recorded two to six days later; one of them written offline.
  putIfFree(overrides, [weekdayDate(year, 1, 1, 3)], { recordedOffsetDays: 3 });
  putIfFree(overrides, [weekdayDate(year, 5, 3, 1)], { recordedOffsetDays: 5, offline: true });
  putIfFree(overrides, [weekdayDate(year, 6, 1, 2)], { recordedOffsetDays: 2 });

  return {
    start,
    end,
    detection: true,
    consentIso: '2026-09-01',
    defaultKind: (isoDay) => {
      const weekday = day(isoDay).getUTCDay();

      if (weekday === 4) return 'HOME'; // Thursday
      if (weekday === 2 && weekIndexOf(isoDay) % 3 !== 0) return 'HOME'; // most Tuesdays

      return 'CH';
    },
    overrides,
    gaps,
  };
}

/**
 * ACCOUNT 2 - Alex Dupont. A year OVER the thresholds, adapting the demo year's
 * over-ceiling character (R273): telework alone exceeds 40 %, so the regime is
 * lost (FISCAL_CEILING_EXCEEDED, A1_REQUIRED) and credited missions fall to zero.
 * Twelve mission days a year, over the ten-day cap (MISSION_CAP_EXCEEDED).
 * Manual throughout - no detection.
 */
function alexYear(year: number, start: string, end: string): YearPlan {
  const overrides = new Map<string, Override>();
  const gaps = new Set<string>([weekdayDate(year, 5, 2, 3), weekdayDate(year, 9, 1, 1)]);

  // Twelve missions a year (eight France, four third-state), all in the first
  // half so the provisional 2026 carries them too. Over the ten-day cap.
  putIfFree(
    overrides,
    [
      weekdayDate(year, 1, 1, 2),
      weekdayDate(year, 1, 3, 4),
      weekdayDate(year, 2, 2, 3),
      weekdayDate(year, 3, 1, 5),
      weekdayDate(year, 3, 3, 1),
      weekdayDate(year, 4, 2, 2),
      weekdayDate(year, 5, 1, 4),
      weekdayDate(year, 6, 2, 3),
    ],
    { kind: 'MISSION_FR' },
  );
  putIfFree(
    overrides,
    [
      weekdayDate(year, 2, 1, 1),
      weekdayDate(year, 4, 1, 3),
      weekdayDate(year, 5, 3, 2),
      weekdayDate(year, 6, 1, 5),
    ],
    { kind: 'MISSION_THIRD' },
  );

  // One edited day, one sick day.
  putIfFree(overrides, [weekdayDate(year, 3, 2, 1)], { kind: 'HOME', editedFrom: 'CH' });
  putIfFree(overrides, [weekdayDate(year, 10, 1, 2)], { kind: 'ABSENT', absenceReason: 'MALADIE' });

  for (const holiday of genevaHolidayWeekdays(year)) {
    putIfFree(overrides, [holiday], { kind: 'ABSENT', absenceReason: 'FERIE' });
  }

  // Two weeks of leave.
  for (const monday of [weekdayDate(year, 7, 2, 1), weekdayDate(year, 8, 2, 1)]) {
    putIfFree(overrides, congeWeek(monday), { kind: 'ABSENT', absenceReason: 'CONGE' });
  }

  // Two days recorded over a week late.
  putIfFree(overrides, [weekdayDate(year, 2, 3, 1)], { recordedOffsetDays: 11 });
  putIfFree(overrides, [weekdayDate(year, 4, 2, 4)], { recordedOffsetDays: 9 });

  return {
    start,
    end,
    detection: false,
    consentIso: null,
    defaultKind: (isoDay) => {
      const weekday = day(isoDay).getUTCDay();

      // Telework alone must clear the 40 % ceiling (regime lost) in BOTH years -
      // and 2026 is the provisional year measured to yesterday against the full
      // 240 basis, so it needs the higher share to cross by October. Monday,
      // Tuesday and Thursday telework; Wednesday and Friday in Switzerland.
      if (weekday === 1 || weekday === 2 || weekday === 4) return 'HOME';

      return 'CH';
    },
    overrides,
    gaps,
  };
}

/**
 * ACCOUNT 3 - Sam Bernard. Half-day granularity, 2026 only, starting partway
 * through the year (a partial period, so the basis is a fraction of 240). Split
 * days - a morning one place, an afternoon another - so the annex shows halves.
 * Comfortably under the ceiling. Manual throughout.
 */
function samYear(start: string, end: string): YearPlan {
  const overrides = new Map<string, Override>();
  const gaps = new Set<string>([weekdayDate(2026, 6, 2, 5)]);

  // Six split days, alternating which half is at home.
  const splits: ReadonlyArray<readonly [string, readonly [EntryKind, EntryKind]]> = [
    [weekdayDate(2026, 3, 2, 2), ['CH', 'HOME']],
    [weekdayDate(2026, 4, 1, 4), ['HOME', 'CH']],
    [weekdayDate(2026, 4, 3, 2), ['CH', 'HOME']],
    [weekdayDate(2026, 5, 2, 3), ['HOME', 'CH']],
    [weekdayDate(2026, 6, 1, 2), ['CH', 'HOME']],
    [weekdayDate(2026, 7, 2, 4), ['CH', 'HOME']],
  ];
  for (const [date, split] of splits) {
    putIfFree(overrides, [date], { split });
  }

  // One mission, one edited day, one sick day.
  putIfFree(overrides, [weekdayDate(2026, 5, 1, 2)], { kind: 'MISSION_FR' });
  putIfFree(overrides, [weekdayDate(2026, 6, 3, 3)], { kind: 'HOME', editedFrom: 'CH' });
  putIfFree(overrides, [weekdayDate(2026, 6, 3, 5)], { kind: 'ABSENT', absenceReason: 'MALADIE' });

  for (const holiday of genevaHolidayWeekdays(2026)) {
    putIfFree(overrides, [holiday], { kind: 'ABSENT', absenceReason: 'FERIE' });
  }

  // One week of leave.
  putIfFree(overrides, congeWeek(weekdayDate(2026, 8, 2, 1)), {
    kind: 'ABSENT',
    absenceReason: 'CONGE',
  });

  // Two days recorded over a week late.
  putIfFree(overrides, [weekdayDate(2026, 3, 3, 3)], { recordedOffsetDays: 9 });
  putIfFree(overrides, [weekdayDate(2026, 4, 2, 1)], { recordedOffsetDays: 10 });

  return {
    start,
    end,
    detection: false,
    consentIso: null,
    defaultKind: (isoDay) => (day(isoDay).getUTCDay() === 3 ? 'HOME' : 'CH'), // Wednesday at home
    overrides,
    gaps,
  };
}

async function seedScenarioAccounts(): Promise<void> {
  const cutoff = iso(yesterday());

  // Camille and Alex are in their second year: 2025 complete, 2026 to yesterday.
  const camillePlans = [
    ...planYear(camilleYear(2025, '2025-01-01', '2025-12-31')),
    ...planYear(camilleYear(2026, '2026-01-01', cutoff)),
  ];
  await seedScenarioAccount(
    {
      email: CAMILLE_EMAIL,
      name: 'Camille Martin',
      granularity: 'DAY',
      loggingMode: 'AUTO_DETECT',
      detectionConsentAt: at('2026-09-01T08:30:00.000'),
      activityStartDate: day('2024-09-02'),
    },
    camillePlans,
  );

  const alexPlans = [
    ...planYear(alexYear(2025, '2025-01-01', '2025-12-31')),
    ...planYear(alexYear(2026, '2026-01-01', cutoff)),
  ];
  await seedScenarioAccount(
    {
      email: ALEX_EMAIL,
      name: 'Alex Dupont',
      granularity: 'DAY',
      loggingMode: 'MANUAL',
      detectionConsentAt: null,
      activityStartDate: day('2024-01-08'),
    },
    alexPlans,
  );

  // Sam started partway through 2026 - a genuinely partial, provisional year.
  const samStart = weekdayDate(2026, 3, 1, 1); // first Monday of March 2026
  const samPlans = planYear(samYear(samStart, cutoff));
  await seedScenarioAccount(
    {
      email: SAM_EMAIL,
      name: 'Sam Bernard',
      granularity: 'HALF_DAY',
      loggingMode: 'MANUAL',
      detectionConsentAt: null,
      activityStartDate: day(samStart),
    },
    samPlans,
  );
}

async function main(): Promise<void> {
  const subscribers = await seedAlertSubscribers();

  console.log(`seeded: ${subscribers} alert subscriber(s) in four states`);

  await seedDemoYear();
  await seedScenarioAccounts();
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
