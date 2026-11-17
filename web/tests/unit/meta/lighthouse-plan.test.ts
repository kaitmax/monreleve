// web/tests/unit/meta/lighthouse-plan.test.ts
//
// FW-LIGHTHOUSE-CALC (R951-R953): WHAT `pnpm lighthouse` MEASURES, UNDER WHICH
// CONDITIONS, AND HOW IT READS WHAT IT MEASURED.
//
// SPEC 21 criterion 8: "LCP < 2.5s slow 4G on the calculator". Until this task
// scripts/lighthouse.mjs measured four routes with the desktop preset, so the
// calculator - the page the criterion names - had never been measured by the
// house gate, and no run used slow 4G (REPORT-FW-LIGHTHOUSE-CALC.txt, R950).
//
// THE CONDITIONS ARE STATED, NOT INHERITED (R345). Lighthouse's default mobile
// run IS simulated slow 4G today, so the cheap version of R952 passes no
// settings and relies on that. A default is a setting nobody chose: the
// values are written down in scripts/lighthouse-plan.mjs, handed to lhci, read
// back from every result, and pinned here against the copy of Lighthouse that
// actually runs - so an upgrade that redefines "slow 4G" fails this file
// instead of quietly moving the criterion.
//
// THE VERDICT IS STRICT. lhci's own maxNumericValue passes at "<=", and the
// criterion is "<". So the LCP check is a pure function, proven here on known
// input in both directions and at the boundary (R154, R196's shape), and on a
// planted regression in the real run (R180, the report).

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CALCULATOR_PATH, COMPARATOR_PATH, isLive } from '@/lib/content/routes';
import { SUITE_COUNTS, readCount } from '../../../scripts/gate-selection.mjs';
import {
  DESKTOP_ROUTES,
  LCP_LIMIT_MS,
  LCP_ROUTE,
  MOBILE_SETTINGS,
  NUMBER_OF_RUNS,
  countLine,
  desktopVerdict,
  lcpVerdict,
  median,
  mobileRc,
  summarizeRuns,
} from '../../../scripts/lighthouse-plan.mjs';

const BASE = 'http://localhost:3300';
const LCP_URL = `${BASE}${CALCULATOR_PATH}`;

interface LighthouseConstants {
  readonly throttling: { readonly mobileSlow4G: Readonly<Record<string, number>> };
  readonly screenEmulationMetrics: { readonly mobile: Readonly<Record<string, number | boolean>> };
  readonly defaultSettings: { readonly formFactor: string; readonly throttlingMethod: string };
}

/**
 * Lighthouse's own definitions, from the copy `pnpm lighthouse` runs.
 *
 * NOT A DIRECT DEPENDENCY: `lighthouse` is installed for @lhci/cli and pnpm
 * does not hoist it, so it is resolved from @lhci/cli's own location - which
 * is exactly the copy lhci spawns for every collection.
 */
async function lighthouseConstants(): Promise<LighthouseConstants> {
  const fromWeb = createRequire(join(process.cwd(), 'package.json'));
  const fromLhci = createRequire(fromWeb.resolve('@lhci/cli/package.json'));
  const manifest = fromLhci.resolve('lighthouse/package.json');
  const url = pathToFileURL(join(dirname(manifest), 'core', 'config', 'constants.js')).href;

  return (await import(url)) as LighthouseConstants;
}

/** A mobile result as Lighthouse writes it, reduced to what the verdict reads. */
function mobileRun(lcp: number | undefined, change: (lhr: Record<string, unknown>) => void = () => {}) {
  const lhr: Record<string, unknown> = {
    requestedUrl: LCP_URL,
    finalDisplayedUrl: LCP_URL,
    // A deep copy: a run whose settings are edited below must not edit the
    // stated values every other test compares against.
    configSettings: JSON.parse(JSON.stringify(MOBILE_SETTINGS)) as Record<string, unknown>,
    categories: { performance: { score: 0.96 } },
    audits: { 'largest-contentful-paint': { numericValue: lcp } },
  };

  change(lhr);

  return lhr;
}

interface RunSettings {
  formFactor: string;
  throttlingMethod: string;
  throttling: Record<string, number>;
  screenEmulation: Record<string, number | boolean>;
}

const settingsOf = (lhr: Record<string, unknown>) => lhr.configSettings as RunSettings;

describe('R951: the desktop floor holds both calculators beside the four routes it already held', () => {
  it('measures the calculator and the comparator, by their constants (R171)', () => {
    expect(DESKTOP_ROUTES).toContain(CALCULATOR_PATH);
    expect(DESKTOP_ROUTES).toContain(COMPARATOR_PATH);
  });

  it('keeps every route R152 and FW18 put on the floor, and is exactly these six', () => {
    // A census, R63's shape: a route dropped from the list would leave every
    // other assertion here passing.
    expect([...DESKTOP_ROUTES]).toEqual([
      '/',
      '/guides',
      '/guides/teletravail-frontalier-40-pourcent',
      '/guides/geneve',
      CALCULATOR_PATH,
      COMPARATOR_PATH,
    ]);
  });

  it('measures only live pages: a 404 would score whatever a 404 scores (R169 corollary)', () => {
    for (const route of DESKTOP_ROUTES) expect(isLive(route), route).toBe(true);
  });
});

describe('R952: the slow-4G collection states its conditions (R345)', () => {
  it('measures the calculator, by its constant', () => {
    expect(LCP_ROUTE).toBe(CALCULATOR_PATH);
  });

  it('holds the limit SPEC 21 criterion 8 names', () => {
    expect(LCP_LIMIT_MS).toBe(2500);
  });

  it('runs three times and reads the median (R174)', () => {
    expect(NUMBER_OF_RUNS).toBe(3);
    expect(mobileRc().ci.collect.numberOfRuns).toBe(NUMBER_OF_RUNS);
  });

  it("states Lighthouse's own slow 4G, checked against the Lighthouse that runs", async () => {
    const lighthouse = await lighthouseConstants();

    expect({ ...MOBILE_SETTINGS.throttling }).toEqual({ ...lighthouse.throttling.mobileSlow4G });
    expect({ ...MOBILE_SETTINGS.screenEmulation }).toEqual({ ...lighthouse.screenEmulationMetrics.mobile });
    expect(MOBILE_SETTINGS.formFactor).toBe('mobile');
    expect(MOBILE_SETTINGS.throttlingMethod).toBe('simulate');
    // And they are what Lighthouse would have applied unasked - which is why
    // they have to be stated: nothing else would show a change of default.
    expect(lighthouse.defaultSettings.formFactor).toBe(MOBILE_SETTINGS.formFactor);
    expect(lighthouse.defaultSettings.throttlingMethod).toBe(MOBILE_SETTINGS.throttlingMethod);
  });

  it('hands lhci exactly those settings, and no desktop preset', () => {
    const settings = mobileRc().ci.collect.settings as unknown as Record<string, unknown>;

    expect(settings).toEqual(JSON.parse(JSON.stringify(MOBILE_SETTINGS)));
    expect(settings).not.toHaveProperty('preset');
  });
});

describe('R952: the LCP verdict, on known input (R154)', () => {
  it('passes when the median is below the limit, keeping every sample in run order', () => {
    const verdict = lcpVerdict([mobileRun(2400), mobileRun(2600), mobileRun(2450)], LCP_URL);

    expect(verdict.status).toBe('pass');
    expect(verdict).toMatchObject({ samples: [2400, 2600, 2450], median: 2450, limitMs: 2500 });
    expect(verdict.why).toContain('2450.0');
    expect(verdict.why).toContain('2400.0, 2600.0, 2450.0');
  });

  it('fails AT the limit, because the criterion is "below 2.5 s"', () => {
    const verdict = lcpVerdict([mobileRun(2500), mobileRun(2500), mobileRun(2400)], LCP_URL);

    expect(verdict.status).toBe('fail');
    expect(verdict).toMatchObject({ median: 2500 });
  });

  it('passes a hair under the limit', () => {
    expect(lcpVerdict([mobileRun(2499.9), mobileRun(2600), mobileRun(2499.9)], LCP_URL).status).toBe(
      'pass',
    );
  });

  it('fails on the median even when one sample is under', () => {
    const verdict = lcpVerdict([mobileRun(2400), mobileRun(2600), mobileRun(2700)], LCP_URL);

    expect(verdict.status).toBe('fail');
    expect(verdict).toMatchObject({ median: 2600 });
  });

  it.each([
    ['a desktop form factor', (lhr: Record<string, unknown>) => (settingsOf(lhr).formFactor = 'desktop'), 'formFactor'],
    ['devtools throttling', (lhr: Record<string, unknown>) => (settingsOf(lhr).throttlingMethod = 'devtools'), 'throttlingMethod'],
    ['an unthrottled CPU', (lhr: Record<string, unknown>) => (settingsOf(lhr).throttling.cpuSlowdownMultiplier = 1), 'throttling.cpuSlowdownMultiplier'],
    ['a faster network', (lhr: Record<string, unknown>) => (settingsOf(lhr).throttling.rttMs = 40), 'throttling.rttMs'],
    ['a desktop screen', (lhr: Record<string, unknown>) => (settingsOf(lhr).screenEmulation.width = 1350), 'screenEmulation.width'],
  ])('refuses a run measured with %s: NO RESULT, never a pass (R154)', (_label, change, named) => {
    const verdict = lcpVerdict([mobileRun(600), mobileRun(600, change), mobileRun(600)], LCP_URL);

    expect(verdict.status).toBe('refused');
    expect(verdict.why).toContain(named);
    expect(verdict.why).toContain('run 2');
  });

  it('refuses a count other than three', () => {
    const verdict = lcpVerdict([mobileRun(2000), mobileRun(2000)], LCP_URL);

    expect(verdict.status).toBe('refused');
    expect(verdict.why).toContain('3');
  });

  it('refuses a run of another page, and a run that landed somewhere else', () => {
    const other = lcpVerdict(
      [mobileRun(2000), mobileRun(2000, (lhr) => (lhr.requestedUrl = `${BASE}/`)), mobileRun(2000)],
      LCP_URL,
    );
    const redirected = lcpVerdict(
      [mobileRun(2000, (lhr) => (lhr.finalDisplayedUrl = `${BASE}/guides`)), mobileRun(2000), mobileRun(2000)],
      LCP_URL,
    );

    expect(other.status).toBe('refused');
    expect(redirected.status).toBe('refused');
  });

  it('refuses a run with no LCP, and a run that ended in an error', () => {
    const missing = lcpVerdict([mobileRun(2000), mobileRun(undefined), mobileRun(2000)], LCP_URL);
    const errored = lcpVerdict(
      [mobileRun(2000), mobileRun(2000), mobileRun(2000, (lhr) => (lhr.runtimeError = { code: 'NO_FCP' }))],
      LCP_URL,
    );

    expect(missing.status).toBe('refused');
    expect(errored.status).toBe('refused');
    expect(errored.why).toContain('NO_FCP');
  });
});

describe('the desktop verdict is read from lhci, never recomputed (R206)', () => {
  const HOME = `${BASE}/`;
  const CALCULATOR = `${BASE}${CALCULATOR_PATH}`;
  const urls = [HOME, CALCULATOR];
  const result = (url: string, category: string, passed: boolean, values = [1, 1, 1]) => ({
    url,
    auditId: 'categories',
    auditProperty: category,
    name: 'minScore',
    operator: '>=',
    expected: 1,
    actual: values[1],
    values,
    level: 'error',
    passed,
  });

  it('counts every assertion lhci passed, across every route', () => {
    const verdict = desktopVerdict(
      [result(HOME, 'performance', true), result(CALCULATOR, 'performance', true), result(CALCULATOR, 'seo', true)],
      urls,
    );

    expect(verdict).toMatchObject({ status: 'pass', passed: 3 });
  });

  it('fails, naming the route, the category and every value, when lhci failed one', () => {
    const verdict = desktopVerdict(
      [result(HOME, 'performance', true), result(CALCULATOR, 'performance', false, [0.71, 0.69, 0.7])],
      urls,
    );

    expect(verdict.status).toBe('fail');
    expect(verdict.failures.join('\n')).toContain(CALCULATOR_PATH);
    expect(verdict.failures.join('\n')).toContain('performance');
    expect(verdict.failures.join('\n')).toContain('0.71, 0.69, 0.7');
  });

  it('refuses when a route was never asserted: absence is not a pass (R133)', () => {
    expect(desktopVerdict([result(HOME, 'performance', true)], urls).status).toBe('refused');
    expect(desktopVerdict([], urls).status).toBe('refused');
  });

  it('refuses a result for a route nobody asked it to measure', () => {
    const verdict = desktopVerdict(
      [result(HOME, 'seo', true), result(CALCULATOR, 'seo', true), result(`${BASE}/elsewhere`, 'seo', true)],
      urls,
    );

    expect(verdict.status).toBe('refused');
  });

  it('can count only what lhci records, so lighthouserc.json records the PASSED assertions too', () => {
    // MEASURED IN THE FIRST PLANTED RUN, not reasoned. lhci writes
    // .lighthouseci/assertion-results.json with its FAILURES only unless
    // includePassedAssertions is set (@lhci/utils assertions.js:
    // `if (options.includePassedAssertions) return results;` then
    // `results.filter(result => !result.passed)`). That run printed "lhci
    // asserted nothing for /, /guides, ..." about the four routes that had
    // PASSED - so without this line every fully green run would read as NO
    // RESULT, and the gate could never pass.
    const rc = JSON.parse(readFileSync(join(process.cwd(), 'lighthouserc.json'), 'utf8')) as {
      ci: { assert: Record<string, unknown> };
    };

    expect(rc.ci.assert.includePassedAssertions).toBe(true);
  });
});

describe('every sample is printed, not only the verdict (R174)', () => {
  it('summarises each route with its three samples and their median', () => {
    const run = (url: string, performance: number, lcp: number) => ({
      requestedUrl: url,
      categories: { performance: { score: performance }, seo: { score: 1 } },
      audits: { 'largest-contentful-paint': { numericValue: lcp } },
    });
    const summary = summarizeRuns([
      run(`${BASE}/`, 1, 600),
      run(`${BASE}${CALCULATOR_PATH}`, 0.99, 590),
      run(`${BASE}/`, 1, 620),
      run(`${BASE}${CALCULATOR_PATH}`, 1, 580),
      run(`${BASE}/`, 0.98, 610),
      run(`${BASE}${CALCULATOR_PATH}`, 1, 585),
    ]);

    expect(summary.map((route) => route.url)).toEqual([`${BASE}/`, `${BASE}${CALCULATOR_PATH}`]);
    expect(summary[1]).toMatchObject({
      runs: 3,
      categories: { performance: { samples: [99, 100, 100], median: 100 }, seo: { median: 100 } },
      lcp: { samples: [590, 580, 585], median: 585 },
    });
    expect(summary[0]?.categories.performance).toEqual({ samples: [100, 100, 98], median: 100 });
  });

  it('takes the median the way lhci does', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('R133: the run reports a count, and the gate can read it', () => {
  it('prints the line SUITE_COUNTS reads, with the number it was given', () => {
    expect(SUITE_COUNTS.lighthouse).toBeDefined();
    expect(readCount('lighthouse', `noise\n${countLine(25)}\nmore noise`)).toEqual({ counted: true, ran: 25 });
  });

  it('fails the gate when the line is missing', () => {
    expect(readCount('lighthouse', 'Done running autorun.').failure).toContain('R133');
  });
});
