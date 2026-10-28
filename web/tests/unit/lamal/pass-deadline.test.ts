// web/tests/unit/lamal/pass-deadline.test.ts
//
// R677 (the operator's Q5, 28.10.2026): AN ANNOUNCED PLAFOND CANNOT STAY
// ANNOUNCED. The 2027 PASS was published as "annonce par l'Urssaf, arrete a
// paraitre" (R671). The arrete normally appears by late December, so the gate
// FAILS from 15 January of the year while that year's plafond is still marked
// announced, and its message points to docs/lamal-refresh.md - which forces
// the switch to 'final' within weeks instead of whenever somebody notices.
//
// THE DATE IS A STATED VALUE, carried by the year itself (passFinalBy), not a
// rule computed here; and the test proves BOTH SIDES of it before it trusts
// the check against today: passes on 14 January, fails on 15.
//
// This file IS the gate check: it runs in `pnpm test`, which `pnpm gate`,
// gate:changed and gate:clone all run.

import { describe, expect, it } from 'vitest';
import { currentDayInParis } from '@/lib/content/tax-year';
import { COMPARATOR_YEARS, overdueAnnouncedPasses } from '@/lib/lamal/years';

describe('the stated deadline', () => {
  it('is 15 January 2027 for the announced 2027 plafond', () => {
    const y2027 = COMPARATOR_YEARS.find((entry) => entry.year === 2027);

    expect(y2027?.passStatus).toBe('announced');
    expect(y2027?.passFinalBy).toBe('2027-01-15');
  });

  it('is carried by every announced year, and by no final one', () => {
    for (const entry of COMPARATOR_YEARS) {
      if (entry.passStatus === 'announced') expect(entry.passFinalBy, String(entry.year)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      else expect(entry.passFinalBy, String(entry.year)).toBeNull();
    }
  });
});

describe('both sides of the date', () => {
  it('passes on 14 January 2027', () => {
    expect(overdueAnnouncedPasses(COMPARATOR_YEARS, '2027-01-14')).toEqual([]);
  });

  it('fails on 15 January 2027, naming the year', () => {
    expect(overdueAnnouncedPasses(COMPARATOR_YEARS, '2027-01-15').map((entry) => entry.year)).toEqual([2027]);
  });

  it('stops failing once the year is marked final', () => {
    const final = COMPARATOR_YEARS.map((entry) => ({ ...entry, passStatus: 'final' as const, passFinalBy: null }));

    expect(overdueAnnouncedPasses(final, '2027-06-01')).toEqual([]);
  });
});

describe('THE CHECK, against today in Europe/Paris', () => {
  it('finds no announced plafond past its date', () => {
    const today = currentDayInParis().toISOString().slice(0, 10);
    const overdue = overdueAnnouncedPasses(COMPARATOR_YEARS, today);

    expect(
      overdue.map((entry) => entry.year),
      `The plafond annuel de la securite sociale for ${overdue.map((entry) => entry.year).join(', ')} is ` +
        `still marked "announced" on ${today}. Read the arrete on Legifrance and switch it to final: ` +
        'docs/lamal-refresh.md, section 4 ("When an announced PASS becomes final").',
    ).toEqual([]);
  });
});
