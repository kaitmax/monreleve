// @vitest-environment jsdom
//
// web/tests/unit/pages/mon-releve.test.tsx
//
// THE SIGNED-IN PAGE, RENDERED. FW-WEB-ACCOUNT (R903 / R225), rebuilt by W12 for
// Web Ruling 32 (R1067).
//
//   R225   every figure the ENGINE computed for a year is on that year's
//          section, formatted by the product's own formatters - never typed;
//   R1067  the page shows the current tax year and the one before, both, with
//          no selector; a year with no rule set of its own carries the
//          engine's warning (RULE_SET_FALLBACK, docs/api-v1.md 6.5) and a year
//          with its own rule set carries none - asserted BOTH WAYS, on either
//          side of a new year, with every year read from its source.
//
// THE YEARS ARE NEVER TYPED (R171). Which year has rules of its own is the
// engine's answer (ruleSetFor names the year it applied); which two years the
// page shows is accountYears(currentTaxYear(clock)), the page's own derivation.
// The clocks are built from the engine's ruled year, so the test still asks
// the right question the day a 2027 rule set is added.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SignedIn, type AccountYearView } from '@/app/(account)/mon-releve/SignedIn';
import { ruleSetFor } from '@/lib/calc-engine';
import { currentTaxYear } from '@/lib/content/tax-year';
import { buildDossier, type AnnexEntry, type Dossier } from '@/lib/dossier/service';
import { DOSSIER_COPY } from '@/lib/fr/dossier';
import { MON_RELEVE_COPY } from '@/lib/fr/mon-releve';
import { warningEntry } from '@/lib/fr/result';
import { formatDays, formatPercent, formatSignedDays } from '@/lib/ui/core';
import { ACCOUNT_PATHS, YEAR_FIELD } from '@/lib/web-account/paths';
import { accountYears } from '@/lib/web-account/year';

const USER = {
  name: 'Camille Rey',
  canton: 'GE',
  employmentRate: 100,
  denominatorKind: 'SIMPLIFIED240',
  exactTotalWorkDays: null,
  granularity: 'DAY',
  activityStartDate: null,
} as const;

/** Whether the engine has a rule set of the year's own - its answer, not ours. */
const hasOwnRules = (year: number): boolean => ruleSetFor(year).taxYear === year;

/** The newest year the engine holds rules for, as the engine names it. */
const RULED = ruleSetFor(currentTaxYear()).taxYear;

/** Two clocks, either side of a new year, built from that year (Europe/Paris noon). */
const NOVEMBER_OF_RULED = new Date(`${String(RULED)}-11-17T11:00:00.000Z`);
const JANUARY_AFTER_RULED = new Date(`${String(RULED + 1)}-01-15T11:00:00.000Z`);

function entry(day: string, kind: AnnexEntry['kind']): AnnexEntry {
  const at = new Date(`${day}T18:00:00.000Z`);

  return {
    dayDate: new Date(`${day}T00:00:00.000Z`),
    portion: 'FULL',
    kind,
    absenceReason: null,
    note: null,
    provenance: 'MANUAL',
    detectedKind: null,
    firstRecordedAt: at,
    lastModifiedAt: null,
    clientClaimedAt: null,
  };
}

/** Four days in February of the year, built by the engine into that year's dossier. */
function dossierFor(year: number, now: Date): Dossier {
  const y = String(year);

  return buildDossier(
    USER,
    [
      entry(`${y}-02-02`, 'HOME'),
      entry(`${y}-02-03`, 'HOME'),
      entry(`${y}-02-04`, 'CH'),
      entry(`${y}-02-05`, 'MISSION_FR'),
    ],
    year,
    now,
  );
}

/** The page's two years at a clock, each with its engine-built dossier. */
function yearsAt(now: Date): AccountYearView[] {
  return accountYears(currentTaxYear(now)).map((year) => ({
    year,
    content: { kind: 'figures', figures: dossierFor(year, now) },
  }));
}

afterEach(cleanup);

function renderPage(years: readonly AccountYearView[], exportFailed = false) {
  return render(<SignedIn email="camille@monreleve.test" years={years} exportFailed={exportFailed} />);
}

const sectionOf = (container: HTMLElement, year: number): HTMLElement => {
  const section = container.querySelector<HTMLElement>(`section[data-year="${String(year)}"]`);

  if (section === null) throw new Error(`no section for ${String(year)}`);

  return section;
};

describe('R1067: two years, the current tax year and the one before, no selector', () => {
  it('renders exactly the two years accountYears names, newest first', () => {
    const now = NOVEMBER_OF_RULED;
    const { container } = renderPage(yearsAt(now));
    const shown = [...container.querySelectorAll('section[data-year]')].map((section) => section.getAttribute('data-year'));

    expect(shown).toEqual(accountYears(currentTaxYear(now)).map(String));
    expect(shown).toHaveLength(2);
  });

  it('offers no way to pick another year: no year link, no select, no year in any href', () => {
    const { container } = renderPage(yearsAt(NOVEMBER_OF_RULED));

    expect(container.querySelector('select')).toBeNull();
    for (const anchor of container.querySelectorAll('a')) {
      expect(anchor.getAttribute('href') ?? '').not.toContain(`${YEAR_FIELD}=`);
    }
  });
});

describe('R1067: a year without its own rule set carries the engine\'s warning - both ways', () => {
  // Both clocks put one year of each kind on the page; the assertions say so
  // first, so neither direction can pass vacuously.
  for (const [label, now] of [
    ['in November of the ruled year', NOVEMBER_OF_RULED],
    ['in January after it', JANUARY_AFTER_RULED],
  ] as const) {
    it(`${label}: the unruled year warns, the ruled year does not`, () => {
      const years = yearsAt(now);
      const shownYears = years.map((view) => view.year);

      expect(shownYears.filter(hasOwnRules), 'a ruled year on the page').toHaveLength(1);
      expect(shownYears.filter((year) => !hasOwnRules(year)), 'an unruled year on the page').toHaveLength(1);

      const { container } = renderPage(years);

      for (const view of years) {
        const section = sectionOf(container, view.year);
        const fallback = section.querySelector('[data-warning="RULE_SET_FALLBACK"]');

        if (hasOwnRules(view.year)) {
          expect(fallback, `${String(view.year)} has its own rules and must not warn`).toBeNull();
        } else {
          const figures = view.content.kind === 'figures' ? view.content.figures : null;
          const warning = figures?.zone.warnings.find((item) => item.code === 'RULE_SET_FALLBACK');

          // The engine emitted it, and the page shows the engine's words for it.
          expect(warning, `the engine did not warn for ${String(view.year)}`).toBeDefined();
          expect(fallback, `${String(view.year)} has no rules of its own and must warn`).not.toBeNull();

          const entry = warningEntry(warning ?? { code: 'RULE_SET_FALLBACK', requestedYear: 0, appliedYear: 0 });

          expect(fallback?.textContent).toContain(entry.heading);
          expect(fallback?.textContent).toContain(entry.body);
          // Before any figure it qualifies.
          const firstFigure = section.querySelector('[data-figure]');

          expect(
            firstFigure !== null && (fallback?.compareDocumentPosition(firstFigure) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
          ).toBeTruthy();
        }
      }
    });
  }

  it('renders every other warning the engine returned for the year, too (api-v1 6.5)', () => {
    const years = yearsAt(NOVEMBER_OF_RULED);
    const { container } = renderPage(years);

    for (const view of years) {
      if (view.content.kind !== 'figures') continue;

      const shown = [...sectionOf(container, view.year).querySelectorAll('[data-warning]')].map((item) =>
        item.getAttribute('data-warning'),
      );

      expect([...shown].sort()).toEqual(view.content.figures.zone.warnings.map((warning) => warning.code).sort());
    }
  });
});

describe('R225: every figure the engine computed is on its year\'s section', () => {
  const years = yearsAt(NOVEMBER_OF_RULED);

  it('found dossiers with something in them, so nothing below passes vacuously', () => {
    for (const view of years) {
      expect(view.content.kind).toBe('figures');
      if (view.content.kind === 'figures') {
        expect(view.content.figures.recordedEntries).toBe(4);
        expect(view.content.figures.tiles.teleworkDays).toBeGreaterThan(0);
      }
    }
  });

  for (const index of [0, 1] as const) {
    it(`year ${String(index + 1)} of 2: the rate, the two headrooms, the four tiles`, () => {
      const view = years[index];

      if (view === undefined || view.content.kind !== 'figures') throw new Error('fixture');

      const dossier = view.content.figures;
      const section = sectionOf(renderPage(years).container, view.year);
      const text = section.textContent ?? '';
      const fiscal = formatSignedDays(dossier.zone.remainingToFiscal);
      const social = formatSignedDays(dossier.zone.remainingToSocial);

      expect(section.querySelector('h2')?.textContent).toBe(MON_RELEVE_COPY.page.yearHeading(view.year));
      expect(section.querySelector('[data-figure="declarableRate"]')?.textContent).toBe(
        formatPercent(dossier.zone.declarableRate, 2),
      );
      expect(text).toContain(DOSSIER_COPY.zone.declarableLabel);
      expect(section.querySelector('[data-figure="remainingToFiscal"]')?.textContent).toBe(fiscal.text);
      expect(section.querySelector('[data-figure="remainingToSocial"]')?.textContent).toBe(social.text);
      expect(text).toContain(fiscal.negative ? DOSSIER_COPY.zone.overFiscal : DOSSIER_COPY.zone.remainingToFiscal);
      expect(text).toContain(social.negative ? DOSSIER_COPY.zone.overSocial : DOSSIER_COPY.zone.remainingToSocial);

      for (const tile of ['workedDays', 'swissDays', 'teleworkDays', 'missionDays'] as const) {
        expect(section.querySelector(`[data-figure="${tile}"]`)?.textContent, tile).toBe(formatDays(dossier.tiles[tile]));
        expect(text).toContain(DOSSIER_COPY.tiles[tile]);
      }
    });
  }

  it('says where the figures come from, once', () => {
    const text = renderPage(years).container.textContent ?? '';

    expect(text.split(MON_RELEVE_COPY.page.figuresNote)).toHaveLength(2);
  });
});

describe('an empty year says so first (R516 on the page)', () => {
  const now = NOVEMBER_OF_RULED;
  const [current, previous] = accountYears(currentTaxYear(now));
  const empty: AccountYearView = { year: current, content: { kind: 'figures', figures: buildDossier(USER, [], current, now) } };
  const full: AccountYearView = { year: previous, content: { kind: 'figures', figures: dossierFor(previous, now) } };

  it('shows the note on the empty year only', () => {
    const { container } = renderPage([empty, full]);

    expect(sectionOf(container, current).querySelector('[data-empty-year]')?.textContent).toBe(
      MON_RELEVE_COPY.page.emptyYear(current),
    );
    expect(sectionOf(container, previous).querySelector('[data-empty-year]')).toBeNull();
  });
});

describe('the downloads and sign-out are POST forms to the account paths (R902)', () => {
  const years = yearsAt(NOVEMBER_OF_RULED);

  it('posts the PDF and the CSV of EACH year, named by its year, and one sign-out', () => {
    const { container } = renderPage(years);

    for (const view of years) {
      const section = sectionOf(container, view.year);
      const forms = [...section.querySelectorAll('form')];

      for (const path of [ACCOUNT_PATHS.exportPdf, ACCOUNT_PATHS.exportCsv]) {
        const form = forms.find((candidate) => candidate.getAttribute('action') === path);

        expect(form?.getAttribute('method'), path).toBe('post');
        expect(form?.querySelector(`input[name="${YEAR_FIELD}"]`)?.getAttribute('value')).toBe(String(view.year));
      }

      const buttons = [...section.querySelectorAll('button')].map((button) => button.textContent);

      expect(buttons).toEqual([MON_RELEVE_COPY.page.downloadPdf(view.year), MON_RELEVE_COPY.page.downloadCsv(view.year)]);
    }

    const signOut = [...container.querySelectorAll('form')].filter(
      (form) => form.getAttribute('action') === ACCOUNT_PATHS.signOut,
    );

    expect(signOut).toHaveLength(1);
    expect(signOut[0]?.getAttribute('method')).toBe('post');
    expect(container.querySelectorAll('form')).toHaveLength(5);
  });

  it('every form posts inside the cookie Path', () => {
    for (const form of renderPage(years).container.querySelectorAll('form')) {
      expect(form.getAttribute('action')?.startsWith(`${ACCOUNT_PATHS.home}/`)).toBe(true);
    }
  });
});

describe('the states with no figures', () => {
  const [current, previous] = accountYears(currentTaxYear(NOVEMBER_OF_RULED));

  it('an incomplete profile: what to do on each year, and no download offered', () => {
    const { container } = renderPage([
      { year: current, content: { kind: 'incomplete' } },
      { year: previous, content: { kind: 'incomplete' } },
    ]);

    for (const year of [current, previous]) {
      expect(sectionOf(container, year).querySelector('[data-incomplete]')?.textContent).toBe(
        MON_RELEVE_COPY.page.incomplete,
      );
    }
    expect(container.querySelectorAll('form')).toHaveLength(1);
  });

  it('a year before the activity began says so, on that year only', () => {
    const { container } = renderPage([
      { year: current, content: { kind: 'figures', figures: dossierFor(current, NOVEMBER_OF_RULED) } },
      { year: previous, content: { kind: 'before-activity' } },
    ]);

    expect(sectionOf(container, previous).querySelector('[data-before-activity]')?.textContent).toBe(
      MON_RELEVE_COPY.page.beforeActivity(previous),
    );
    expect(sectionOf(container, current).querySelector('[data-before-activity]')).toBeNull();
  });

  it('a refused download says so', () => {
    const { container } = renderPage(yearsAt(NOVEMBER_OF_RULED), true);

    expect(container.querySelector('[data-export-failed]')?.textContent).toBe(MON_RELEVE_COPY.page.exportFailed);
  });
});
