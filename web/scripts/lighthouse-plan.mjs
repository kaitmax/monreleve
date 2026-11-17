// web/scripts/lighthouse-plan.mjs
//
// WHAT `pnpm lighthouse` MEASURES, UNDER WHICH CONDITIONS, AND HOW IT READS
// WHAT IT MEASURED. FW-LIGHTHOUSE-CALC, R951-R953.
//
// PURE, AND SEPARATE FROM scripts/lighthouse.mjs FOR ONE REASON: that script
// builds, serves and drives Chrome the moment it is imported, so nothing in
// it can be asserted in a unit test. The routes, the stated conditions and
// the two verdicts live here, where tests/unit/meta/lighthouse-plan.test.ts
// proves them on known input; lighthouse.mjs does the I/O around them.
//
// ---------------------------------------------------------------------------
// R950, WHY THE CALCULATOR WAS ABSENT. Nothing excluded it. FW1 planned "the
// LCP gate tightens at FW11", which never happened; R152 put a floor on "the
// first real guide", FW18 extended it to /guides/geneve, and FW20b moved the
// list here unchanged. FW-COMPARATEUR-SURFACE asked whether the calculator
// and the comparator should be measured permanently, and the answer was "out
// of scope, a gate-config change (R247 class) ... recorded for the operator"
// (RULINGS-2026-11-03, Advisor Ruling 2). PARK-HA10 left the slow-4G gate
// open as "a ruling". SPEC 21 criterion 8 is that ruling's source.
// ---------------------------------------------------------------------------

/**
 * The routes the desktop floor holds at 100 in all four categories (R152,
 * R174, R951), three runs each, median asserted by lighthouserc.json.
 *
 * LITERALS, ASSERTED AGAINST THE CONSTANTS. A .mjs cannot import
 * lib/content/routes.ts, so the two calculators are typed here and the unit
 * test compares them with CALCULATOR_PATH and COMPARATOR_PATH (R171, R185's
 * shape) and requires every route to be live in the registry: a 404 would
 * score whatever a 404 scores.
 */
export const DESKTOP_ROUTES = Object.freeze([
  '/',
  '/guides',
  '/guides/teletravail-frontalier-40-pourcent',
  '/guides/geneve',
  '/calculateur-teletravail-frontalier',
  '/calculateur-lamal-cmu',
]);

/** SPEC 21 criterion 8 names one page: the calculator. */
export const LCP_ROUTE = '/calculateur-teletravail-frontalier';

/**
 * SPEC 21 criterion 8: "LCP < 2.5s slow 4G on the calculator".
 *
 * STRICTLY BELOW, and that is why the check is here rather than in lhci:
 * lhci's maxNumericValue passes at `<=`, so 2500.0 would read green against
 * a criterion it does not meet. A miss is a QUESTION with its numbers, never
 * a looser value (R952, R954).
 */
export const LCP_LIMIT_MS = 2500;

/** R174: a sampled measurement gets a better sample - three runs, the median. */
export const NUMBER_OF_RUNS = 3;

/**
 * The conditions of the slow-4G collection, STATED (R345).
 *
 * They are Lighthouse 12's own mobile defaults - its `mobileSlow4G` profile
 * (core/config/constants.js, defined in trace_engine's lantern Constants),
 * simulated, on its moto g power screen - and that is exactly why they are
 * written down: a run that relied on the defaults would measure whatever the
 * next Lighthouse calls slow 4G, and nothing would say the criterion had
 * moved. The unit test pins these values against the Lighthouse lhci runs;
 * lcpVerdict reads them back from every result and refuses a run that did not
 * use them (R154: proven to deliver, not assumed).
 *
 * THE EXPRESSIONS ARE LIGHTHOUSE'S OWN, so the values are bit-identical to
 * its constants: 1.6 * 1024 * 0.9 is 1474.5600000000002, not 1474.56.
 *
 * PERFORMANCE ONLY. R952 asserts one metric; the other categories are the
 * desktop floor's, and gathering them here would cost run time and assert
 * nothing.
 */
export const MOBILE_SETTINGS = Object.freeze({
  formFactor: 'mobile',
  throttlingMethod: 'simulate',
  throttling: Object.freeze({
    rttMs: 150,
    throughputKbps: 1.6 * 1024,
    requestLatencyMs: 150 * 3.75,
    downloadThroughputKbps: 1.6 * 1024 * 0.9,
    uploadThroughputKbps: 750 * 0.9,
    cpuSlowdownMultiplier: 4,
  }),
  screenEmulation: Object.freeze({
    mobile: true,
    width: 412,
    height: 823,
    deviceScaleFactor: 1.75,
    disabled: false,
  }),
  onlyCategories: Object.freeze(['performance']),
});

/**
 * The lhci configuration for the slow-4G collection.
 *
 * A WHOLE CONFIG, NOT FLAGS ON TOP OF lighthouserc.json: lhci reads only the
 * file `--config` names when one is given, so nothing of the desktop preset
 * can leak into this run - and the read-back in lcpVerdict is what proves it.
 */
export function mobileRc() {
  return { ci: { collect: { numberOfRuns: NUMBER_OF_RUNS, settings: MOBILE_SETTINGS } } };
}

/**
 * The median, as lhci computes it for an assertion: the middle value of an
 * odd count, the mean of the two middle values of an even one.
 *
 * @param {readonly number[]} values
 */
export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor((sorted.length - 1) / 2);

  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle] + sorted[middle + 1]) / 2;
}

const ms = (value) => value.toFixed(1);

/** The place a stated object and an applied one first differ, or null. */
function firstDifference(name, stated, applied) {
  for (const key of Object.keys(stated)) {
    const actual = applied === null || typeof applied !== 'object' ? undefined : applied[key];

    if (actual !== stated[key]) {
      return `${name}.${key} ${JSON.stringify(actual)}, not the stated ${JSON.stringify(stated[key])}`;
    }
  }

  return null;
}

/**
 * R952's verdict over the slow-4G results.
 *
 * THREE ANSWERS, NOT TWO. `pass` and `fail` are about the calculator; `refused`
 * means the results cannot answer - the wrong count, another page, an error,
 * or a run that was not under the stated conditions - and it is NO RESULT,
 * never a pass. The plant cannot tell a mobile run from a desktop one (a
 * blocking script fails both), so the conditions are read back here: a green
 * median near 600 ms would be the desktop preset, and is refused by name.
 *
 * @param {readonly any[]} lhrs the collection's results, in run order
 * @param {string} url the calculator's URL on the server that was measured
 */
export function lcpVerdict(lhrs, url) {
  if (lhrs.length !== NUMBER_OF_RUNS) {
    return {
      status: 'refused',
      why: `expected ${NUMBER_OF_RUNS} slow-4G runs of ${url}, found ${lhrs.length}`,
    };
  }

  const samples = [];

  for (const [index, lhr] of lhrs.entries()) {
    const run = `run ${index + 1}`;

    if (lhr.runtimeError) {
      return { status: 'refused', why: `${run} ended in ${lhr.runtimeError.code ?? 'a runtime error'}` };
    }

    if (lhr.requestedUrl !== url) {
      return { status: 'refused', why: `${run} measured ${lhr.requestedUrl}, not ${url}` };
    }

    const landed = lhr.finalDisplayedUrl ?? lhr.finalUrl;

    if (landed !== url) {
      return { status: 'refused', why: `${run} landed on ${landed}, not ${url}` };
    }

    const settings = lhr.configSettings ?? {};

    for (const key of ['formFactor', 'throttlingMethod']) {
      if (settings[key] !== MOBILE_SETTINGS[key]) {
        return {
          status: 'refused',
          why:
            `${run} ran with ${key} ${JSON.stringify(settings[key])}, not the stated ` +
            `${JSON.stringify(MOBILE_SETTINGS[key])} (R345)`,
        };
      }
    }

    const differs =
      firstDifference('throttling', MOBILE_SETTINGS.throttling, settings.throttling) ??
      firstDifference('screenEmulation', MOBILE_SETTINGS.screenEmulation, settings.screenEmulation);

    if (differs !== null) {
      return { status: 'refused', why: `${run} ran with ${differs} (R345)` };
    }

    const value = lhr.audits?.['largest-contentful-paint']?.numericValue;

    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return { status: 'refused', why: `${run} reported no largest-contentful-paint` };
    }

    samples.push(value);
  }

  const middle = median(samples);
  const passed = middle < LCP_LIMIT_MS;

  return {
    status: passed ? 'pass' : 'fail',
    samples,
    median: middle,
    limitMs: LCP_LIMIT_MS,
    why:
      `median ${ms(middle)} ms ${passed ? '<' : 'is not <'} ${LCP_LIMIT_MS} ms ` +
      `(samples ${samples.map(ms).join(', ')})`,
  };
}

/**
 * The desktop floor's verdict, READ FROM lhci's own assertion results.
 *
 * NEVER RECOMPUTED (R206): lighthouserc.json is the floor's one home and lhci
 * decides each assertion. What this adds is the two questions lhci does not
 * ask - did every route we asked for get asserted at all, and did anything
 * get asserted that we did not ask for - plus the count the gate reads.
 *
 * @param {readonly any[]} results lhci's .lighthouseci/assertion-results.json
 * @param {readonly string[]} urls the routes' URLs on the server measured
 */
export function desktopVerdict(results, urls) {
  const failures = [];
  const missing = urls.filter((url) => !results.some((result) => result.url === url));
  const stray = [...new Set(results.map((result) => result.url))].filter((url) => !urls.includes(url));
  let passed = 0;

  for (const result of results) {
    if (result.passed) {
      passed += 1;
    } else if (result.level !== 'warn') {
      const property = [result.auditProperty ?? []].flat().join('.');

      failures.push(
        `${result.url} ${result.auditId}${property === '' ? '' : `.${property}`} ` +
          `${result.name} expected ${result.operator ?? ''}${result.expected} found ${result.actual} ` +
          `(values ${(result.values ?? []).join(', ')})`,
      );
    }
  }

  if (missing.length > 0 || stray.length > 0) {
    return {
      status: 'refused',
      passed,
      failures,
      why:
        (missing.length > 0 ? `lhci asserted nothing for ${missing.join(', ')}` : '') +
        (missing.length > 0 && stray.length > 0 ? '; ' : '') +
        (stray.length > 0 ? `lhci asserted a route nobody asked for: ${stray.join(', ')}` : ''),
    };
  }

  if (failures.length > 0) {
    return { status: 'fail', passed, failures, why: `${failures.length} assertion(s) below the floor` };
  }

  return { status: 'pass', passed, failures, why: `${passed} assertion(s) at the floor across ${urls.length} route(s)` };
}

/**
 * Every route's samples and medians, for the log (R174: the samples are the
 * evidence, the median is the verdict). Scores as 0-100, LCP in ms.
 *
 * @param {readonly any[]} lhrs
 */
export function summarizeRuns(lhrs) {
  const byUrl = new Map();

  for (const lhr of lhrs) {
    if (!byUrl.has(lhr.requestedUrl)) byUrl.set(lhr.requestedUrl, []);
    byUrl.get(lhr.requestedUrl).push(lhr);
  }

  return [...byUrl].map(([url, runs]) => {
    const categories = {};

    for (const id of Object.keys(runs[0].categories ?? {})) {
      const samples = runs.map((run) => Math.round((run.categories?.[id]?.score ?? Number.NaN) * 100));

      categories[id] = { samples, median: median(samples) };
    }

    const lcps = runs.map((run) => run.audits?.['largest-contentful-paint']?.numericValue);
    const lcp = lcps.every((value) => typeof value === 'number')
      ? { samples: lcps, median: median(lcps) }
      : null;

    return { url, runs: runs.length, categories, lcp };
  });
}

/**
 * The line the gate reads (R133): gate-selection.mjs's SUITE_COUNTS holds
 * the pattern, and the unit test feeds it this function's output.
 *
 * @param {number} checks
 */
export function countLine(checks) {
  return `Lighthouse checks  ${checks} passed`;
}
