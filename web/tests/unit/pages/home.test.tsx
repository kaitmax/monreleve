// @vitest-environment jsdom
//
// web/tests/unit/pages/home.test.tsx
//
// FW34: the home page's load-bearing claims, asserted at the surface that makes
// them (R225, R154). The copy guards one layer down already prove the sentences
// are well-formed French and type no figure; this proves the RENDERER places
// them, that the hero's figures are the ENGINE's, and that the two rules cite
// rows that are actually verified.
//
// POSITIVE DELIVERY, not absence (R154). Each figure is computed here from the
// engine and the RuleSet - never typed - and asserted present in the rendered
// HTML, so a card wired to nothing, or an interpolation left empty, fails. The
// hero figures come from calculateTelework over the SAME fixture the page uses,
// so a change to the example moves both together (R163, R171).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import HomePage from '@/app/(public)/page';
import {
  calculateTelework,
  type TeleworkResult,
} from '@/lib/calc-engine';
import { HERO_EXAMPLE_TELEWORK_DAYS, heroExampleInput, HOME_GUIDE_SLUGS } from '@/lib/content/home';
import { RESULT_PATH } from '@/lib/content/routes';
import { currentTaxYear } from '@/lib/content/tax-year';
import { guideScope } from '@/lib/guides/scope';
import { publishedGuides } from '@/lib/guides/registry';
import { HOME_COPY } from '@/lib/fr/home';
import { PARAM_NAMES } from '@/lib/params/schema';
import { formatPercent, formatSignedDays } from '@/lib/ui/core';
import { typedFiguresIn } from '../../support/typed-figures';

afterEach(cleanup);

const YEAR = currentTaxYear();
const SCOPE = guideScope(YEAR);

function heroResult(): TeleworkResult {
  const outcome = calculateTelework(heroExampleInput(YEAR));

  if (!outcome.ok) throw new Error('the hero example must be a valid engine input');

  return outcome.value;
}

describe('the hero phone card is the engine, not a picture (R147, R163)', () => {
  it('renders the rate, and the days before each ceiling, exactly as the engine computes them', () => {
    const result = heroResult();
    const { container } = render(<HomePage />);
    const text = container.textContent ?? '';

    // The rate RateDisplay prints, at its two decimals - from the engine.
    expect(text).toContain(formatPercent(result.declarableRate, 2));
    // The two headroom tiles - from the engine, never typed.
    expect(text).toContain(formatSignedDays(result.remainingToFiscal).text);
    expect(text).toContain(formatSignedDays(result.remainingToSocial).text);
  });

  it('narrates the fixture with its own days and basis, not a typed figure', () => {
    const { container } = render(<HomePage />);
    const text = container.textContent ?? '';

    // The example days (38) and the basis (240) come from the fixture and the
    // RuleSet; the caption interpolates both.
    expect(text).toContain(String(HERO_EXAMPLE_TELEWORK_DAYS));
    expect(text).toContain(SCOPE.basisDays);
  });
});

describe('the two rules name thresholds from the RuleSet (R147)', () => {
  it('delivers the fiscal, social and A1 figures into the rendered cards', () => {
    const { container } = render(<HomePage />);
    const text = container.textContent ?? '';

    expect(text).toContain(SCOPE.fiscal);
    expect(text).toContain(SCOPE.social);
    expect(text).toContain(SCOPE.a1Threshold);
    expect(text).toContain(SCOPE.missionCap);
  });
});

describe('each rule cites a source that is actually verified (R146, R167)', () => {
  const register = readFileSync(
    join(process.cwd(), '..', 'docs', 'regulatory-sources.md'),
    'utf8',
  );

  it('the fiscal card cites the accord amiable, which the register carries as verified', () => {
    expect(HOME_COPY.rules.fiscal.source).toContain('29 avril 2026');
    expect(HOME_COPY.rules.fiscal.source).toContain('AFC Genève');
    // The accord of 29 April 2026 is a verified row in the register (REG-APPLY).
    expect(register).toContain('29 APRIL 2026');
    expect(register).toContain('VERIFIED');
  });

  it('the social card cites the OFAS, the register’s source for 49,9 %', () => {
    expect(HOME_COPY.rules.social.source).toContain('OFAS');
    expect(register).toContain('OFAS');
  });

  it('the sources strip cites the two instruments and links /sources', () => {
    const { container } = render(<HomePage />);
    const link = container.querySelector('a[href="/sources"]');

    expect(link, 'a link to /sources').not.toBeNull();
    expect(HOME_COPY.sources.claim).toContain('avenant');
    expect(HOME_COPY.sources.claim).toContain('accord amiable');
  });
});

describe('the calculator is a no-JS form to the existing params (R156)', () => {
  it('submits GET to the page that ANSWERS the params (R351)', () => {
    const { container } = render(<HomePage />);
    const form = container.querySelector('form');

    expect(form?.getAttribute('method')?.toLowerCase()).toBe('get');
    // IT POINTED AT THE CALCULATOR UNTIL R351, which was honest while the
    // form was built and the calculator did not calculate. That route is
    // static by FW13 ruling and its island reads the URL on mount, so with
    // scripting off this form handed its reader a page that could not
    // answer - measured on a production build: the params arrived, the
    // page showed the same empty state as the bare path.
    expect(form?.getAttribute('action')).toBe(RESULT_PATH);
  });

  it('every field maps to a param the calculator already knows - none invented', () => {
    const { container } = render(<HomePage />);
    const form = container.querySelector('form');
    const names = [...(form?.querySelectorAll('[name]') ?? [])].map((el) =>
      el.getAttribute('name'),
    );

    expect(names).toEqual(['canton', 'tt', 'mfr']);
    for (const name of names) {
      expect(PARAM_NAMES, `${String(name)} is a known calculator param`).toContain(name);
    }
  });
});

describe('the guides are derived, not typed (R181, R147)', () => {
  it('shows each chosen guide under its own breadcrumbLabel, with no typed figure', () => {
    const published = publishedGuides();
    const { container } = render(<HomePage />);
    const text = container.textContent ?? '';

    for (const slug of HOME_GUIDE_SLUGS) {
      const guide = published.find((g) => g.frontmatter.slug === slug);

      expect(guide, `${slug} is a published guide`).toBeDefined();

      const label = guide?.frontmatter.breadcrumbLabel ?? '';

      expect(text).toContain(label);
      // The label carries no regulatory figure - that is why the design's
      // "40 %" / "49,9 %" labels are not transcribed.
      expect(typedFiguresIn(label)).toEqual([]);
      expect(container.querySelector(`a[href="/guides/${slug}"]`)).not.toBeNull();
    }
  });
});

describe('the app section is pre-release and honest (R138, R172)', () => {
  it('reads "Bientot sur Android" and points to the regulatory alerts page', () => {
    const { container } = render(<HomePage />);
    const text = container.textContent ?? '';

    expect(text).toContain(HOME_COPY.app.heading);
    // The launch sign-up is parked (PARK-FW34-LAUNCH); the section links to the
    // regulatory alerts page, named for what it is - never a launch-email form.
    expect(container.querySelector('a[href="/alertes"]')).not.toBeNull();
    expect(container.querySelector('input[type="email"]')).toBeNull();
  });
});
