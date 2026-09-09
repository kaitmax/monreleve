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

  it('gives the explanation a heading, one level below the h1', () => {
    const { container } = render(<CalculateurPage />);

    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(container.querySelectorAll('h3')).toHaveLength(0);
  });

  it('renders NO result region yet, because there is nothing to show', () => {
    // AC3: with JavaScript disabled the page shows the copy and the form and
    // NO result. In increment 1 there is not even a form, and an empty live
    // region would announce nothing to a screen reader on every navigation.
    const { container } = render(<CalculateurPage />);

    expect(container.querySelectorAll('[aria-live]')).toHaveLength(0);
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
