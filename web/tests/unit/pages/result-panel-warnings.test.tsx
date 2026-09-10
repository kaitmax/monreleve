// @vitest-environment jsdom
//
// web/tests/unit/pages/result-panel-warnings.test.tsx
//
// FW12 increment 4: the warning banners, and the one contextual link.
//
// TWO PROPERTIES, and they fail differently.
//
// COMPLETENESS is a compile-time property wherever it can be. A new engine
// code with no copy must not be a banner that renders an empty box; SPEC 8's
// rule for ValidationError, applied to the two unions the panel reads. The
// Record types in lib/fr/result.ts do that work, and what is left for a test
// is the part types cannot see: that the ORDER list also covers the union,
// and that the copy is non-empty rather than merely present.
//
// ORDER is a runtime property, and it is the one that needed a test. All
// eight banners render correctly in any order, so a diff that reorders them
// looks like a formatting change - and the order is a claim about what a
// reader should deal with first.
//
// THE ORDER IS NOT THE ENGINE'S. warnings.ts pushes codes in whatever
// sequence its checks happen to run, which is an implementation detail of the
// engine and would silently become the product's priority ordering. So the
// panel declares its own, and this asserts the two are decoupled by feeding
// the panel a REVERSED warning list and expecting the declared order out.
//
// WHY THE RESULTS ARE PART-SYNTHETIC. The eight codes do not co-occur: no
// single input can emit RULE_SET_FALLBACK and EXACT_METHOD_UNVERIFIED and a
// social breach at once, and contriving eight inputs would test the engine's
// emission rules, which lib/calc-engine's own tests own. So every numeric
// field here is a real engine result and only `warnings` is substituted - the
// panel is a renderer of warning lists, and the list is what is under test.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ResultPanel } from '@/app/(public)/calculateur-teletravail-frontalier/ResultPanel';
import {
  type TeleworkInput,
  type TeleworkResult,
  type Warning,
  calculateTelework,
  ruleSetFor,
} from '@/lib/calc-engine';
import CalculateurPage from '@/app/(public)/calculateur-teletravail-frontalier/page';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { LEGAL_COPY } from '@/lib/fr/legal';
import { RESULT_COPY, WARNING_CODES, warningEntry } from '@/lib/fr/result';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';
import { type Status } from '@/lib/ui/core';

afterEach(cleanup);

const TAX_YEAR = 2026;
const RULES = ruleSetFor(TAX_YEAR);

const BASE: TeleworkInput = {
  taxYear: TAX_YEAR,
  canton: 'GE',
  employmentRate: 100,
  periodFraction: 1,
  denominator: { kind: 'simplified240' },
  granularity: 'halfDay',
  teleworkDays: 84,
  missionDaysFrance: 24,
  missionDaysThirdState: 0,
};

const resultFor = (input: TeleworkInput): TeleworkResult => {
  const outcome = calculateTelework(input);

  if (!outcome.ok) throw new Error(`fixture does not compute: ${outcome.error[0]?.code ?? ''}`);

  return outcome.value;
};

/** One member per code, with plausible payloads for the four that carry data. */
const SAMPLE: { readonly [C in Warning['code']]: Extract<Warning, { code: C }> } = {
  FISCAL_CEILING_EXCEEDED: { code: 'FISCAL_CEILING_EXCEEDED', regime: 'source' },
  MISSION_CAP_EXCEEDED: { code: 'MISSION_CAP_EXCEEDED', cap: 10, excess: 4 },
  MISSIONS_EXCEED_HEADROOM: { code: 'MISSIONS_EXCEED_HEADROOM', excess: 6 },
  SOCIAL_CEILING_EXCEEDED: { code: 'SOCIAL_CEILING_EXCEEDED' },
  A1_REQUIRED: { code: 'A1_REQUIRED' },
  FRONTALIER_STATUS_AT_RISK: { code: 'FRONTALIER_STATUS_AT_RISK' },
  EXACT_METHOD_UNVERIFIED: { code: 'EXACT_METHOD_UNVERIFIED' },
  RULE_SET_FALLBACK: { code: 'RULE_SET_FALLBACK', requestedYear: 2099, appliedYear: 2026 },
};

const ALL_WARNINGS: readonly Warning[] = WARNING_CODES.map((code) => SAMPLE[code]);

const panelWith = (warnings: readonly Warning[], input: TeleworkInput = BASE) => {
  const { container } = render(
    <ResultPanel
      input={input}
      result={{ ...resultFor(input), warnings }}
      thresholds={RULES}
    />,
  );

  return container;
};

/** The banners as rendered: heading and body, in DOM order. */
const bannersOf = (warnings: readonly Warning[], input: TeleworkInput = BASE) => {
  const slot = panelWith(warnings, input).querySelector('[data-panel="warnings"]');

  if (slot === null) throw new Error('no warnings slot');

  return [...slot.querySelectorAll('[data-warning]')].map((banner) => ({
    code: banner.getAttribute('data-warning') ?? '',
    // textContent, not getByText: ruling R66 - the DOM normaliser would
    // collapse the no-break spaces these sentences are asserted on.
    text: banner.textContent ?? '',
  }));
};

describe('one banner per warning, and nothing when there are none', () => {
  it('renders one per code', () => {
    expect(bannersOf(ALL_WARNINGS)).toHaveLength(WARNING_CODES.length);
  });

  it('renders none, and no heading, for a clean result', () => {
    // The slot still exists - the panel's shape does not depend on the input
    // having produced a warning - but "A savoir" over an empty list would
    // read as a missing sentence.
    const container = panelWith([]);
    const slot = container.querySelector('[data-panel="warnings"]');

    expect(slot).not.toBeNull();
    expect(slot?.querySelectorAll('[data-warning]')).toHaveLength(0);
    expect(slot?.textContent ?? '').toBe('');
  });

  it('drops nothing when the engine sends a code twice', () => {
    // WARNING_ORDER is applied with flatMap over a filter, so a duplicate
    // would render twice rather than being deduplicated - and the engine does
    // not emit duplicates. This says which of the two behaviours is in place,
    // because the alternative reading is a banner silently disappearing.
    const twice = [SAMPLE.A1_REQUIRED, SAMPLE.A1_REQUIRED];

    expect(bannersOf(twice)).toHaveLength(2);
  });
});

describe('the order is the panel’s, not the engine’s', () => {
  it('is stable under a reversed input', () => {
    const forward = bannersOf(ALL_WARNINGS).map((banner) => banner.code);
    const backward = bannersOf([...ALL_WARNINGS].reverse()).map((banner) => banner.code);

    expect(backward).toEqual(forward);
  });

  it('puts the rule-set fallback first, because it qualifies every figure', () => {
    // A calculation performed under a year's rules that were never published
    // for the year asked about is a statement about the whole panel, not one
    // of its consequences. R11: "the substitution must reach the user rather
    // than being implied by a taxYear a caller has to think to compare."
    expect(bannersOf(ALL_WARNINGS)[0]?.code).toBe('RULE_SET_FALLBACK');
  });

  it('puts the fiscal ceiling above the social one', () => {
    // Both are breaches; the fiscal one is the one that moves taxable income
    // and, in a 1983 canton, the status itself. SPEC 9.3's "order is
    // decision-relevance" applies inside the list as well as between slots.
    const codes = bannersOf(ALL_WARNINGS).map((banner) => banner.code);

    expect(codes.indexOf('FISCAL_CEILING_EXCEEDED')).toBeLessThan(
      codes.indexOf('SOCIAL_CEILING_EXCEEDED'),
    );
  });

  it('covers every code in the union, so a new one cannot render unordered', () => {
    // THE GAP THIS CLOSES. WARNING_ORDER was written with seven of the eight
    // codes in it - RULE_SET_FALLBACK was deliberately left out while its
    // message had no way to name the two years - and a code missing from the
    // list is not a broken banner but NO banner. Silence, from a panel whose
    // whole job is to say what the numbers mean.
    const rendered = bannersOf(ALL_WARNINGS).map((banner) => banner.code);

    expect([...rendered].sort()).toEqual([...WARNING_CODES].sort());
  });
});

describe('the rule-set fallback names both years (R11)', () => {
  it('says which year was asked for and which was applied', () => {
    const text = bannersOf([SAMPLE.RULE_SET_FALLBACK])[0]?.text ?? '';

    expect(text).toContain('2099');
    expect(text).toContain('2026');
  });

  it('does not group the year as a quantity', () => {
    // SPEC 6.4's group separator is U+202F, so a year run through the number
    // formatter reads "2 099". A year is a label, not a count.
    const text = bannersOf([SAMPLE.RULE_SET_FALLBACK])[0]?.text ?? '';

    expect(text).not.toContain(`2${String.fromCharCode(0x202f)}099`);
    expect(text).not.toContain('2 099');
  });

  it('is silent for a year that has its own rules (R55)', () => {
    // R55: "expected to be silent while 2026 is the only rule set", asserted
    // so that the banner appearing one day is a visible change rather than a
    // surprise. This is the engine's own emission, not a substituted list.
    const real = resultFor(BASE);

    expect(real.warnings.map((warning) => warning.code)).not.toContain('RULE_SET_FALLBACK');
  });
});

describe('the fiscal breach reads differently in a 1983 canton', () => {
  // THE PAYLOAD IS WHY THIS BRANCH EXISTS. FISCAL_CEILING_EXCEEDED carries
  // the regime, and until increment 4 the body could not read it: it named
  // the 1983 clause unconditionally, which told every reader in a
  // source-taxed canton that their frontalier status might be at stake when
  // it is not - and told the readers where it IS exactly what
  // FRONTALIER_STATUS_AT_RISK says on its own line just below.
  const source = warningEntry({ code: 'FISCAL_CEILING_EXCEEDED', regime: 'source' });
  const residence = warningEntry({
    code: 'FISCAL_CEILING_EXCEEDED',
    regime: 'residence-1983',
  });

  it('says the same thing under one heading', () => {
    expect(source.heading).toBe(residence.heading);
  });

  it('names the status only where it is at stake', () => {
    expect(residence.body).toContain('statut de frontalier');
    expect(source.body).not.toContain('statut de frontalier');
  });

  it('still names the consequence that applies to both', () => {
    // Non-vacuity: the source body is a different sentence, not a shorter
    // one that dropped the point.
    expect(source.body).toContain('imposables en France');
    expect(residence.body).toContain('imposables en France');
  });

  it('renders the regime the engine reported, not a default', () => {
    const text = bannersOf([{ code: 'FISCAL_CEILING_EXCEEDED', regime: 'source' }])[0]?.text;

    expect(text).toContain(source.body);
    expect(text).not.toContain(residence.body);
  });
});

describe('every code has copy that says something', () => {
  it.each(WARNING_CODES)('%s has a non-empty heading and body', (code) => {
    const entry = warningEntry(SAMPLE[code]);

    expect(entry.heading.trim().length).toBeGreaterThan(0);
    expect(entry.body.trim().length).toBeGreaterThan(20);
  });

  it('gives each code a heading of its own', () => {
    // Eight banners, eight sentences. A duplicated heading means two
    // different situations reading identically, which is the R73 failure in a
    // different place.
    const headings = WARNING_CODES.map((code) => warningEntry(SAMPLE[code]).heading);

    expect(new Set(headings).size).toBe(WARNING_CODES.length);
  });

  it('names no threshold figure in any body (R73)', () => {
    // "40 %", "49,9 %" and "10 jours" belong to the year's RuleSet (SPEC
    // 7.7). A sentence containing one is a second source of truth that goes
    // stale in silence after a rule change with nothing failing - so the copy
    // says "le plafond annuel" and "un quart", and the figures live in the
    // tiles and the rail where they come from the rules.
    for (const code of WARNING_CODES) {
      const entry = warningEntry(SAMPLE[code]);
      const both = `${entry.heading} ${entry.body}`;

      expect(both, code).not.toContain('%');
      expect(both, code).not.toMatch(/\b(?:40|49|10)\b/u);
    }
  });

  it('renders the body, not just the heading', () => {
    // A banner that rendered only its heading would pass every order
    // assertion above.
    const text = bannersOf([SAMPLE.A1_REQUIRED])[0]?.text ?? '';
    const entry = warningEntry(SAMPLE.A1_REQUIRED);

    expect(text).toContain(entry.heading);
    expect(text).toContain(entry.body);
  });
});

describe('exactly one contextual link, chosen by status (SPEC 9.3)', () => {
  const STATUSES: readonly Status[] = [
    'compliant',
    'mission-exposure',
    'regime-lost',
    'social-switch',
  ];

  it.each(STATUSES)('%s has its own text and destination', (status) => {
    const link = RESULT_COPY.links[status];

    expect(link.text.trim().length).toBeGreaterThan(0);
    expect(link.href.startsWith('/')).toBe(true);
  });

  it('gives no two statuses the same link', () => {
    // Four statuses share one panel slot, so a copy-paste in the map would
    // send a reader whose regime is lost to the mission-days guide with
    // nothing failing.
    const texts = STATUSES.map((status) => RESULT_COPY.links[status].text);
    const hrefs = STATUSES.map((status) => RESULT_COPY.links[status].href);

    expect(new Set(texts).size).toBe(STATUSES.length);
    expect(new Set(hrefs).size).toBe(STATUSES.length);
  });

  it('renders one and only one', () => {
    const slot = panelWith(ALL_WARNINGS).querySelector('[data-panel="link"]');

    expect(slot?.children).toHaveLength(1);
  });
});

describe('the standing disclaimer is said once, not twice (increment 6)', () => {
  // FOUND BY LOOKING AT A BASELINE, which is the second time that has been
  // the finding mechanism on this page.
  //
  // calculateur-panneau-regime-perdu-mobile.png shows the sentence
  // "Estimation fournie a titre indicatif..." twice, about 60 px apart: once
  // as the panel's slot 6 (SPEC 9.3's order) and once as the page-level note
  // increment 0 put above the /sources link. 1633 tests passed. Every
  // assertion about the legal note asked whether it was PRESENT, and it was -
  // twice.
  //
  // WHY IT HAPPENED. Increment 0 needed an UNCONDITIONAL, server-rendered
  // disclosure surface: P2 has no input trigger, so a reader must be able to
  // reach /sources whatever they type and with scripting off. The panel's
  // note is inside the client island and only exists once there is a result,
  // so it cannot serve that purpose - and increment 1 then added the panel's
  // own note from SPEC 9.3's order without either noticing the other.
  //
  // WHAT IS KEPT. SPEC 9.3 puts a legal note in the panel and SPEC 9.1 puts
  // $legal-01 in the footer; both stay, and they are a screen apart. What
  // goes is the copy I added mid-page, whose actual job - the /sources link -
  // stays exactly where it was. The sentence itself is still in the served
  // HTML with scripting off, from the footer, which is a server component.
  const STANDING = LEGAL_COPY.standing;

  const occurrences = (text: string, needle: string): number =>
    text.split(needle).length - 1;

  it('says it once inside main when there is a result', () => {
    const { container } = render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.canton.label), {
      target: { value: 'GE' },
    });
    fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.days.label), {
      target: { value: '110' },
    });

    const main = container.querySelector('main');

    expect(main).not.toBeNull();
    expect(main?.textContent ?? '').toContain(STANDING);
    expect(occurrences(main?.textContent ?? '', STANDING)).toBe(1);
  });

  it('and once inside main when there is not', () => {
    // The empty state has no panel, so the one occurrence has to be the
    // panel's absence rather than the page-level copy still being there.
    const { container } = render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    const main = container.querySelector('main');

    expect(occurrences(main?.textContent ?? '', STANDING)).toBe(0);
  });

  it('keeps the footer copy, which is SPEC 9.1 and not the panel', () => {
    // Non-vacuity in the other direction: scoping to main must not be a way
    // of counting one of two copies. The footer's is outside main, on every
    // page, and stays.
    const { container } = render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    const footer = container.querySelector('footer');

    expect(occurrences(footer?.textContent ?? '', STANDING)).toBe(1);
  });

  it('keeps the /sources link the mid-page note was carrying', () => {
    // THE PART THAT MUST SURVIVE THE REMOVAL. R113: P2 has no input trigger,
    // so its only disclosure is /sources, and the link to it has to be
    // unconditional and in the server HTML.
    const { container } = render(<CalculateurPage />);
    const links = [...container.querySelectorAll('a')].filter(
      (link) => link.getAttribute('href') === '/sources',
    );

    expect(links).toHaveLength(1);
  });
});
