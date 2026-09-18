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

async function main(): Promise<void> {
  const subscribers = await seedAlertSubscribers();

  console.log(`seeded: ${subscribers} alert subscriber(s) in four states`);

  await seedDemoYear();
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
