// @vitest-environment jsdom
//
// web/tests/unit/pages/calculateur.test.tsx
//
// FW11 increment 1: the server shell. The form island is increment 2, so what
// is asserted here is the content that must be there WITHOUT it - AC3's "never
// a blank shell".
//
// NO PLACEHOLDER CENSUS. The legal pages consume ruling R52's entity constants
// and this page consumes none, so describePlaceholderCensus does not apply.
// Said explicitly because its absence would otherwise look like an omission.
//
// THE THRESHOLDS ARE ASSERTED AS COMING FROM THE RULE SET, not as literals -
// ruling R73's principle applied to prose. A test that expected the string
// "40 %" would pass just as happily against copy that hardcoded it, which is
// the failure this page's copy module is shaped to prevent.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CalculateurPage, { generateMetadata } from '@/app/(public)/calculateur-teletravail-frontalier/page';
import { ruleSetFor } from '@/lib/calc-engine';
import { LAST_REGULATORY_REVIEW } from '@/lib/content/regulatory';
import { CALCULATOR_PATH, gateRobotsDirective } from '@/lib/content/routes';
import { currentTaxYear } from '@/lib/content/tax-year';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { LEGAL_COPY } from '@/lib/fr/legal';
import { formatPercent } from '@/lib/ui/core';

afterEach(cleanup);

const YEAR = currentTaxYear();
const RULES = ruleSetFor(YEAR);

/** The same rendering the page uses: no decimal when the value is whole. */
const ceiling = (rate: number): string => {
  const percent = rate * 100;

  return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
};

const FISCAL = ceiling(RULES.fiscalCeiling);
const SOCIAL = ceiling(RULES.socialCeiling);

const pageText = (): string => {
  const { container } = render(<CalculateurPage />);

  return container.textContent ?? '';
};

describe('the shell that survives without JavaScript (AC3)', () => {
  it('renders exactly one h1, and it is the page title', () => {
    const { container } = render(<CalculateurPage />);

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h1')?.textContent).toBe(CALCULATEUR_COPY.title);
  });

  it('sets the form measure through Container narrow', () => {
    // FD1:45 puts the form in a 720 px column, which is Container's `narrow`.
    // Asserted through the data attribute because CSS Module class names are
    // hashed.
    const { container } = render(<CalculateurPage />);

    expect(container.querySelectorAll('[data-width="narrow"]')).toHaveLength(1);
  });

  it('renders the intro with both thresholds, from the RuleSet', () => {
    expect(pageText()).toContain(CALCULATEUR_COPY.intro(FISCAL, SOCIAL));
  });

  it('renders all three explanatory paragraphs', () => {
    // The content that makes the page worth reaching when the island never
    // hydrates. SPEC 9.3: "the calculation needs JavaScript; the page must be
    // meaningful without it."
    const text = pageText();

    expect(text).toContain(CALCULATEUR_COPY.fiscal(FISCAL));
    expect(text).toContain(CALCULATEUR_COPY.social(SOCIAL));
    expect(text).toContain(CALCULATEUR_COPY.missions(FISCAL));
  });

  it('skips no heading level below the h1', () => {
    // WAS "exactly one h2", which was true of increment 1 and stopped being
    // true when increment 4's result region brought its own heading. Counting
    // headings was never the rule anyway - the rule is that the outline has
    // no gap, because a screen-reader user navigating by heading loses the
    // structure at the first skipped level. This states that instead, and
    // survives the next section.
    const { container } = render(<CalculateurPage />);
    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading) =>
      Number(heading.tagName.slice(1)),
    );

    expect(levels.length).toBeGreaterThan(1);
    expect(levels[0]).toBe(1);
    expect([...new Set(levels)].sort()).toEqual([1, 2]);
  });

  it('renders a result region holding no number until there is input', () => {
    // WAS "no result region at all", which was right for increment 1 - there
    // was not even a form then, and an empty live region announces nothing on
    // every navigation. Increment 4 gives the region a purpose, so the
    // assertion moves to the thing AC3 actually cares about: the page must
    // show no RESULT before anybody has typed, whether or not JavaScript ran.
    const { container } = render(<CalculateurPage />);
    const live = container.querySelectorAll('[aria-live]');

    expect(live).toHaveLength(1);
    expect(live[0]?.getAttribute('aria-live')).toBe('polite');
    expect(live[0]?.textContent).toBe(CALCULATEUR_COPY.result.empty);

    // No rate, and not even a percent sign: the region is prose until the
    // engine has something to say.
    expect(live[0]?.textContent).not.toContain('%');
  });
});

describe('ruling R55: the year', () => {
  it('shows the tax year above the form', () => {
    expect(pageText()).toContain(CALCULATEUR_COPY.yearCaption(YEAR));
  });

  it('is the Europe/Paris year, not a hardcoded one', () => {
    // If the caption were a literal it would pass this too - so the assertion
    // is that the rendered year MATCHES the resolver, and the resolver has its
    // own boundary tests in tests/unit/content/tax-year.test.ts.
    expect(pageText()).toContain(String(YEAR));
    expect(YEAR).toBe(currentTaxYear());
  });

  it('resolves a RuleSet for that year without falling back', () => {
    // R55: "it is expected to be silent while 2026 is the only rule set." If
    // this ever fails, RULE_SET_FALLBACK has become reachable from the page
    // and increment 4 owes a banner.
    expect(RULES.taxYear).toBe(YEAR);
  });
});

describe('the thresholds are not written into the copy (R73)', () => {
  it('takes them as arguments, so a rule change cannot leave them stale', () => {
    // Called with deliberately wrong values: if the copy hardcoded the real
    // ceilings, these would not appear and the real ones would.
    const invented = CALCULATEUR_COPY.fiscal('33 %');

    expect(invented).toContain('33 %');
    expect(invented).not.toContain(FISCAL);
  });

  it('renders the RuleSet values on the actual page', () => {
    const text = pageText();

    expect(text).toContain(FISCAL);
    expect(text).toContain(SOCIAL);
  });
});

describe('ruling R54: the metadata gate', () => {
  it('names the threshold and the year in the description (SPEC 14)', () => {
    const meta = generateMetadata();

    expect(String(meta.description)).toContain(FISCAL);
    expect(String(meta.description)).toContain(String(YEAR));
  });

  it('is indexable today, because the review is recorded', () => {
    const meta = generateMetadata();

    expect(LAST_REGULATORY_REVIEW).not.toBeNull();
    expect(meta.robots).toBeUndefined();
  });

  it('would be noindex if the review were withdrawn', () => {
    // The branch that no longer occurs in production. gateRobotsDirective
    // takes the review so this is an ordinary call rather than a mocked
    // module - the page delegates to it for exactly this reason.
    expect(gateRobotsDirective(null)).toEqual({ index: false, follow: true });
    expect(gateRobotsDirective('2026-09-09')).toBeNull();
  });

  it('keeps follow true even when refusing to be indexed', () => {
    // noindex asks not to be LISTED. nofollow would also strand the legal
    // pages this page links to through the footer.
    expect(gateRobotsDirective(null)?.follow).toBe(true);
  });

  it('is the route the registry gates', () => {
    expect(CALCULATOR_PATH).toBe('/calculateur-teletravail-frontalier');
  });
});

describe('ruling R113: the always-present path to /sources', () => {
  // WHY THIS IS IN THE LEGAL NOTE and not in the provisional notice. P2 - the
  // 49,9 versus under-50 edge - has NO input trigger by design, so the
  // conditional notice never mentions it. A reader can only reach it through
  // something that is on the page whatever they type.
  //
  // The operator's own account of the hole: "I designed P2 with no input
  // trigger and then pointed its only disclosure at a planned route, while the
  // calculator went live."

  it('links to /sources from the standing legal note', () => {
    const { container } = render(<CalculateurPage />);
    const link = [...container.querySelectorAll('a')].find(
      (anchor) => anchor.getAttribute('href') === CALCULATEUR_COPY.form.sourcesLink.href,
    );

    expect(link, 'no link to /sources on the calculator').toBeDefined();
    expect(link?.textContent).toBe(CALCULATEUR_COPY.form.sourcesLink.text);
  });

  it('carries the standing disclaimer beside it (SPEC 9.3 item 6)', () => {
    const { container } = render(<CalculateurPage />);

    expect(container.textContent).toContain(LEGAL_COPY.standing);
  });

  it('shows the note whether or not anything has been typed', () => {
    // The whole point: unconditional. A conditional disclosure cannot carry
    // an interpretation that has no condition.
    const { container } = render(<CalculateurPage />);

    expect(container.textContent).not.toContain(CALCULATEUR_COPY.result.stale);
    expect(container.textContent).toContain(CALCULATEUR_COPY.form.sourcesLink.text);
  });
});
