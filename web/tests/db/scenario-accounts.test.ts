// web/tests/db/scenario-accounts.test.ts
//
// SEED-RELEVE: the three scenario accounts the seed produces beside the frozen
// demo year. Camille (under the fiscal ceiling, detection switched on in
// September 2026), Alex (over the ceiling, mission days over the cap) and Sam
// (half-day granularity, a partial 2026). They exist so a person can SEE a real
// releve - two years of it - on the phone, and so the dossier can be read back
// against what an accountant asks for.
//
// IT RUNS THE REAL COMMAND, like demo-year.test.ts: beforeAll shells out to the
// seed so the accounts are proven to arrive through `pnpm db:seed`, not through
// a function import that the CLI could still fail on (R154).
//
// WHAT IS ASSERTED, AND WHAT IS NOT. The scenario accounts are CLOCK-DEPENDENT
// by design - "2026 to yesterday" moves every day (R197: no entry after
// yesterday) - so nothing here pins an exact count or an exact rate. It asserts
// the SHAPE each scenario promises: the settings agree with the entries (R202),
// the timestamps are all in the past, detection never precedes consent, the
// over/under-ceiling character holds, the half-day annex has split days, and the
// evidence cases the prompt names (late, edited, gap, missions, absences) are
// present. The demo year's exact-count contract lives in demo-year.test.ts and
// is untouched.

import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import type { Entry, EntryEvent, User } from '@prisma/client';
import { buildDossierFor } from '@/lib/dossier/load';

const CAMILLE = 'camille.martin@example.invalid';
const ALEX = 'alex.dupont@example.invalid';
const SAM = 'sam.bernard@example.invalid';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

interface Account {
  user: User;
  entries: Entry[];
  events: EntryEvent[];
}

const accounts = new Map<string, Account>();

async function load(email: string): Promise<Account> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const entries = await prisma.entry.findMany({
    where: { userId: user.id },
    orderBy: [{ dayDate: 'asc' }, { portion: 'asc' }],
  });
  const events = await prisma.entryEvent.findMany({
    where: { userId: user.id },
    orderBy: { recordedAt: 'asc' },
  });

  return { user, entries, events };
}

beforeAll(async () => {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'seed'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  for (const email of [CAMILLE, ALEX, SAM]) {
    accounts.set(email, await load(email));
  }
}, 240_000);

afterAll(async () => {
  await prisma.$disconnect();
});

function account(email: string): Account {
  const found = accounts.get(email);

  if (found === undefined) throw new Error(`account ${email} was not seeded`);

  return found;
}

function yearEntries(email: string, year: number): Entry[] {
  return account(email).entries.filter((entry) => entry.dayDate.getUTCFullYear() === year);
}

describe('the three accounts exist, with holder names so their PDFs generate', () => {
  it.each([
    [CAMILLE, 'Camille Martin'],
    [ALEX, 'Alex Dupont'],
    [SAM, 'Sam Bernard'],
  ])('%s is named %s', (email, name) => {
    expect(account(email).user.name).toBe(name);
  });

  it('uses only the reserved .invalid domain, which can never deliver', () => {
    for (const email of [CAMILLE, ALEX, SAM]) {
      expect(email.endsWith('@example.invalid')).toBe(true);
    }
  });
});

describe('every timestamp is in the past, and no day is after yesterday (R197)', () => {
  it.each([CAMILLE, ALEX, SAM])('%s records nothing in the future', (email) => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const { entries, events } = account(email);

    expect(entries.length).toBeGreaterThan(20);

    for (const entry of entries) {
      // No entry dated today or later: the product refuses a future day, and a
      // seed that wrote one would describe a world that cannot happen.
      expect(entry.dayDate.getTime()).toBeLessThan(startOfToday.getTime());
      expect(entry.firstRecordedAt.getTime()).toBeLessThan(now);
    }

    for (const event of events) {
      expect(event.recordedAt.getTime()).toBeLessThan(now);
    }
  });
});

describe('every entry carries a CREATED event, and edited days carry a MODIFIED one', () => {
  it.each([CAMILLE, ALEX, SAM])('%s has one CREATED event per entry', (email) => {
    const { entries, events } = account(email);
    const created = events.filter((event) => event.action === 'CREATED');

    expect(created).toHaveLength(entries.length);

    const stamps = new Map(entries.map((entry) => [entry.id, entry.firstRecordedAt.getTime()]));

    for (const event of created) {
      expect(event.recordedAt.getTime()).toBe(stamps.get(event.entryId));
    }
  });
});

describe('ACCOUNT 1 - Camille Martin: under the ceiling, detection from September 2026', () => {
  it('is Geneva, 100 %, the 240-day simplified method, whole days', () => {
    const { user } = account(CAMILLE);

    expect(user.canton).toBe('GE');
    expect(user.employmentRate).toBe(100);
    expect(user.denominatorKind).toBe('SIMPLIFIED240');
    expect(user.granularity).toBe('DAY');
  });

  it('has a full 2025 and a 2026 up to yesterday', () => {
    expect(yearEntries(CAMILLE, 2025).length).toBeGreaterThan(150);
    expect(yearEntries(CAMILLE, 2026).length).toBeGreaterThan(80);

    // A full year reaches every month; the shape of "janvier a decembre".
    const months2025 = new Set(yearEntries(CAMILLE, 2025).map((entry) => entry.dayDate.getUTCMonth()));

    expect(months2025.size).toBe(12);
  });

  it('switched detection on in September 2026, so no day is detected before then (R202)', () => {
    const { user, entries } = account(CAMILLE);

    expect(user.loggingMode).toBe('AUTO_DETECT');
    expect(user.detectionConsentAt).not.toBeNull();
    expect(user.detectionConsentAt!.getUTCFullYear()).toBe(2026);
    expect(user.detectionConsentAt!.getUTCMonth()).toBe(8); // September (0-based)

    const consent = user.detectionConsentAt!.getTime();

    for (const entry of entries) {
      if (entry.provenance !== 'MANUAL') {
        // A detected day cannot precede the consent that made detection legal.
        expect(entry.dayDate.getTime()).toBeGreaterThanOrEqual(
          Date.UTC(2026, 8, 1) - 24 * 60 * 60 * 1000,
        );
        expect(entry.detectedAt).not.toBeNull();
        expect(entry.detectedAt!.getTime()).toBeGreaterThanOrEqual(consent - 24 * 60 * 60 * 1000);
      }
    }
  });

  it('has detected-confirmed days and exactly the two corrected ones the prompt asks for', () => {
    const { entries } = account(CAMILLE);
    const confirmed = entries.filter((entry) => entry.provenance === 'DETECTED_CONFIRMED');
    const corrected = entries.filter((entry) => entry.provenance === 'DETECTED_CORRECTED');

    expect(confirmed.length).toBeGreaterThan(0);
    expect(corrected).toHaveLength(2);

    for (const entry of corrected) {
      expect(entry.detectedKind).not.toBeNull();
      expect(entry.detectedKind).not.toBe(entry.kind);
    }

    for (const entry of confirmed) {
      expect(entry.detectedKind).toBe(entry.kind);
    }
  });

  it('never proposes an absence - detection knows a country, not a reason', () => {
    for (const entry of account(CAMILLE).entries.filter((candidate) => candidate.kind === 'ABSENT')) {
      expect(entry.detectedKind).toBeNull();
      expect(entry.provenance).toBe('MANUAL');
    }
  });

  it('has the evidence cases: five recorded over a week late, some a few days late, three edited', () => {
    const { entries, events } = account(CAMILLE);
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const lateness = (entry: Entry): number =>
      entry.firstRecordedAt.getTime() - entry.dayDate.getTime();

    // Over a week late (saisie tardive), a few days late, and most the same evening.
    expect(entries.filter((entry) => lateness(entry) > SEVEN_DAYS).length).toBeGreaterThanOrEqual(5);
    expect(
      entries.filter((entry) => lateness(entry) > ONE_DAY && lateness(entry) <= SEVEN_DAYS).length,
    ).toBeGreaterThanOrEqual(3);
    expect(entries.filter((entry) => lateness(entry) < ONE_DAY).length).toBeGreaterThan(10);

    const byEntry = new Map<string, EntryEvent[]>();

    for (const event of events) {
      byEntry.set(event.entryId, [...(byEntry.get(event.entryId) ?? []), event]);
    }

    const edited = [...byEntry.values()].filter((trail) => trail.length > 1);

    expect(edited.length).toBeGreaterThanOrEqual(3);

    for (const trail of edited) {
      const created = trail.find((event) => event.action === 'CREATED');
      const modified = trail.find((event) => event.action === 'MODIFIED');

      expect(created).toBeDefined();
      expect(modified).toBeDefined();
      expect(created!.kind).not.toBe(modified!.kind);
    }
  });

  it('leaves a working day or two unrecorded, so Non renseigne has something to show', async () => {
    // The dossier annex prints every weekday; recordedEntries counts the ones
    // that carry an entry. A gap is a weekday the annex shows with no entry.
    const dossier = await buildDossierFor(account(CAMILLE).user.id, 2025);
    const unlogged = dossier.annex.filter((row) => !row.recorded);

    expect(unlogged.length).toBeGreaterThanOrEqual(2);
  });

  it('carries seven missions a year - four France, three third-state - under the ten-day cap', () => {
    for (const year of [2025, 2026]) {
      const rows = yearEntries(CAMILLE, year);
      const fr = rows.filter((entry) => entry.kind === 'MISSION_FR').length;
      const third = rows.filter((entry) => entry.kind === 'MISSION_THIRD').length;

      // 2026 is partial; its missions may be fewer, but 2025 is the full promise.
      if (year === 2025) {
        expect(fr).toBe(4);
        expect(third).toBe(3);
      } else {
        expect(fr).toBeGreaterThan(0);
      }
    }
  });

  it('has Geneva public holidays and five weeks of leave and sick days as absences', () => {
    const rows2025 = yearEntries(CAMILLE, 2025);
    const ferie = rows2025.filter((entry) => entry.absenceReason === 'FERIE').length;
    const conge = rows2025.filter((entry) => entry.absenceReason === 'CONGE').length;
    const maladie = rows2025.filter((entry) => entry.absenceReason === 'MALADIE').length;

    // Geneva has nine legal holidays; those on a weekday appear. Five weeks of
    // leave is up to 25 weekday entries; three sick days are three.
    expect(ferie).toBeGreaterThanOrEqual(5);
    expect(conge).toBeGreaterThanOrEqual(20);
    expect(maladie).toBe(3);
  });

  it('declares comfortably under the 40 % fiscal ceiling for the full year 2025', async () => {
    const dossier = await buildDossierFor(account(CAMILLE).user.id, 2025);

    expect(dossier.zone.declarableRate).toBeLessThan(40);
    expect(dossier.zone.declarableRate).toBeGreaterThan(20);
    expect(dossier.zone.warnings.map((warning) => warning.code)).not.toContain(
      'FISCAL_CEILING_EXCEEDED',
    );
  });

  it("2025's releve carries RULE_SET_FALLBACK, because 2025's rules are not encoded", async () => {
    const dossier = await buildDossierFor(account(CAMILLE).user.id, 2025);

    expect(dossier.zone.warnings.map((warning) => warning.code)).toContain('RULE_SET_FALLBACK');
  });
});

describe('ACCOUNT 2 - Alex Dupont: over the ceiling, missions over the cap', () => {
  it('is a manual logger, Geneva, whole days, with no detection', () => {
    const { user, entries } = account(ALEX);

    expect(user.canton).toBe('GE');
    expect(user.loggingMode).toBe('MANUAL');
    expect(user.detectionConsentAt).toBeNull();

    for (const entry of entries) {
      expect(entry.provenance).toBe('MANUAL');
      expect(entry.detectedKind).toBeNull();
    }
  });

  it('has a full 2025 and a 2026 to date', () => {
    expect(yearEntries(ALEX, 2025).length).toBeGreaterThan(150);
    expect(yearEntries(ALEX, 2026).length).toBeGreaterThan(80);
  });

  it('exceeds the fiscal ceiling and needs the A1, both years', async () => {
    for (const year of [2025, 2026]) {
      const dossier = await buildDossierFor(account(ALEX).user.id, year);
      const codes = dossier.zone.warnings.map((warning) => warning.code);

      expect(dossier.zone.declarableRate).toBeGreaterThan(40);
      expect(codes).toContain('FISCAL_CEILING_EXCEEDED');
      expect(codes).toContain('A1_REQUIRED');
    }
  });

  it('logs twelve mission days a year, over the ten-day cap', async () => {
    const rows2025 = yearEntries(ALEX, 2025);
    const missions = rows2025.filter(
      (entry) => entry.kind === 'MISSION_FR' || entry.kind === 'MISSION_THIRD',
    ).length;

    expect(missions).toBe(12);

    const dossier = await buildDossierFor(account(ALEX).user.id, 2025);

    expect(dossier.zone.warnings.map((warning) => warning.code)).toContain('MISSION_CAP_EXCEEDED');
  });
});

describe('ACCOUNT 3 - Sam Bernard: half-day granularity, a partial 2026', () => {
  it('is a half-day logger, and only 2026 exists', () => {
    const { user } = account(SAM);

    expect(user.granularity).toBe('HALF_DAY');
    expect(yearEntries(SAM, 2025)).toHaveLength(0);
    expect(yearEntries(SAM, 2026).length).toBeGreaterThan(40);
  });

  it('started partway through 2026, so the period is a fraction of the year', async () => {
    const { user } = account(SAM);

    expect(user.activityStartDate).not.toBeNull();
    expect(user.activityStartDate!.getUTCFullYear()).toBe(2026);

    const dossier = await buildDossierFor(user.id, 2026);

    expect(dossier.period.fraction).toBeLessThan(1);
    expect(dossier.period.startDate).not.toBeNull();
  });

  it('has split days: a morning one place and an afternoon another', () => {
    const halves = account(SAM).entries.filter((entry) => entry.portion !== 'FULL');

    expect(halves.length).toBeGreaterThanOrEqual(6);

    const byDay = new Map<string, Entry[]>();

    for (const entry of halves) {
      const day = entry.dayDate.toISOString().slice(0, 10);

      byDay.set(day, [...(byDay.get(day) ?? []), entry]);
    }

    const splitDays = [...byDay.values()].filter((pair) => pair.length === 2);

    expect(splitDays.length).toBeGreaterThanOrEqual(3);

    for (const pair of splitDays) {
      const portions = pair.map((entry) => entry.portion).sort();

      expect(portions).toEqual(['AM', 'PM']);
    }
  });

  it('stays under the fiscal ceiling, with a half-day annex to read', async () => {
    const dossier = await buildDossierFor(account(SAM).user.id, 2026);

    expect(dossier.zone.declarableRate).toBeLessThan(40);

    const halfRows = dossier.annex.filter((row) => row.portion === 'AM' || row.portion === 'PM');

    expect(halfRows.length).toBeGreaterThanOrEqual(6);
  });
});
