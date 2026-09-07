// web/lib/ui/react/ThresholdRail/ThresholdRail.test.tsx
//
// The first React test in the repository.
//
// RENDERED WITH react-dom/server, NOT React Testing Library. RTL, a DOM
// environment (jsdom/happy-dom) and jest-axe are all absent from
// package.json - verified, not assumed - and adding a dependency is an
// ask-first item under CLAUDE.md, so the question is with the operator and
// this suite does not pre-empt it.
//
// renderToStaticMarkup needs no DOM and no new dependency, and it asserts
// exactly what the FW8 protocol asks for: "rendered text, roles and
// attributes, never implementation". What it CANNOT do is interaction,
// focus, or anything requiring a live document - and the a11y gate (AC1's
// jest-axe) is genuinely blocked, recorded as a blocking question in
// REPORT-FW8.txt rather than faked with a weaker check.

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';
import { ZONE_BAND_NAME } from '@/lib/fr/rail';
import { ThresholdRail } from './ThresholdRail';

const RULES = ruleSetFor(2026);
const THRESHOLDS = {
  fiscalCeiling: RULES.fiscalCeiling,
  socialCeiling: RULES.socialCeiling,
};

const render = (props: Partial<Parameters<typeof ThresholdRail>[0]> = {}): string =>
  renderToStaticMarkup(
    <ThresholdRail
      percentage={39.16}
      zone="compliant"
      thresholds={THRESHOLDS}
      variant="inline"
      width={376}
      {...props}
    />,
  );

describe('it renders the FW7 generator, not a second drawing', () => {
  it('injects the SVG the core module produces', () => {
    const html = render();

    expect(html).toContain('<svg');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Taux de t');
  });

  it('passes the thresholds through, so a moved ceiling moves the tick', () => {
    // R35's whole point, checked at the wrapper: the component must not
    // substitute its own ceilings for the caller's.
    const shifted = render({ thresholds: { fiscalCeiling: 0.5, socialCeiling: 0.6 } });

    expect(shifted).toContain('>50 %<');
    expect(shifted).toContain('>60 %<');
    expect(render()).toContain('>40 %<');
  });
});

describe('the legend R45 displaced from the SVG', () => {
  it('renders all three band names for inline', () => {
    // R45 moved these out of the geometry because centring words over bands
    // cannot work - "Imposition France" is 93,7 px over a band 9,9 % of the
    // track wide. Here a real layout engine measures and wraps them.
    const html = render({ variant: 'inline' });

    for (const name of Object.values(ZONE_BAND_NAME)) {
      expect(html).toContain(name);
    }
  });

  it('omits the legend entirely for compact', () => {
    const html = render({ variant: 'compact' });

    for (const name of Object.values(ZONE_BAND_NAME)) {
      expect(html).not.toContain(name);
    }
  });

  it('gives each dot its band token as a custom property, never a hex', () => {
    const html = render({ variant: 'inline' });

    expect(html).toContain('var(--colour-success)');
    expect(html).toContain('var(--colour-warning)');
    expect(html).toContain('var(--colour-error)');
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('marks the dots decorative, because the name beside them carries it', () => {
    // SPEC 16: never colour-only. The band NAME is the text half; the dot is
    // a swatch. Announcing it would read the same information twice.
    const html = render({ variant: 'inline' });

    expect(html).toContain('aria-hidden="true"');
  });
});

describe('the unavailable state (R33)', () => {
  const unavailable = (): string => render({ percentage: Number.NaN });

  it('renders rather than throwing', () => {
    expect(() => unavailable()).not.toThrow();
    expect(unavailable()).toContain('Taux indisponible');
  });

  it('announces it politely', () => {
    expect(unavailable()).toContain('aria-live="polite"');
    expect(unavailable()).toContain('Taux de télétravail déclarable indisponible.');
  });

  it('carries no band colour anywhere, legend included', () => {
    // The rail already drops its fill; the legend must not reintroduce the
    // colours, or the component would still imply a position it does not know.
    const html = unavailable();

    for (const token of ['--colour-success', '--colour-warning', '--colour-error']) {
      expect(html).not.toContain(token);
    }
  });

  it('says nothing in a live region when the rate IS available', () => {
    // A live region that is always present announces on every recalculation.
    expect(render()).not.toContain('aria-live');
  });
});

describe('it maps rather than decides', () => {
  it('never calls zoneFor - asserted from the source', () => {
    // The same structural proof the rail carries: Zone arrives as a prop, so
    // there is nothing to compute. A spy would show it was not called for one
    // input; this shows it cannot be called for any.
    // Comments stripped first. The component's own header explains that it
    // never calls zoneFor, so scanning the raw text finds the EXPLANATION and
    // fails. Third time this repo has hit that shape: the generated SCSS
    // named the selector its rule forbade, and the rail's header named the
    // custom property its check scanned for. A file that documents its own
    // rule contains the string the rule forbids.
    const source = new URL('./ThresholdRail.tsx', import.meta.url);
    const code = readFileSync(source, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ');

    expect(code).not.toMatch(/\bzoneFor\b/);
    expect(code).not.toMatch(/\bstatusFor\b/);
  });
});
