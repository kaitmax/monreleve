// web/e2e/global-setup.ts
//
// RULING R169: THE SUITE ASSERTS WHAT IT IS POINTED AT, FIRST.
//
// THE MEASUREMENT THAT PRODUCED THE RULE. FW20 opened with the e2e suite
// pointed at another project's container, which happened to be publishing
// port 3000, and ran it: **91 tests passed against a different application.**
// Not failed - passed.
//
// The mechanism is worth stating because it is not specific to ports:
// ABSENCE ASSERTIONS ARE SATISFIED BY ABSENCE. /sources 404s on a foreign
// server; a 404 page has no horizontal overflow; so every R127 check holds -
// scrollWidth <= clientWidth is true, and "every element inside the viewport
// at 320 dp" is true because all of nothing is inside it. The assertions that
// pass hardest against the wrong product are the ones written to prove a
// defect is absent.
//
// So the suite establishes WHOSE server it is talking to before any spec
// runs, and refuses the whole run otherwise. Three lines of check against
// every ruling that rests on the suite meaning anything - R127, R148, R159,
// R164 all inherit whatever lower bound this has.
//
// WHY /api/health AND NOT A PAGE. A page can be mimicked by any server that
// returns HTML, and matching on markup would make this a second, weaker copy
// of the tests. The health route answers JSON that names the product, and a
// foreign app cannot answer it by accident: it either 404s, or returns a body
// with no `service` field, or names something else. All three abort.
//
// IT RUNS BEFORE THE SPECS AND AFTER THE SERVER. Playwright starts
// `webServer` before `globalSetup`, so the address is live by the time this
// runs; the poll below exists for the seconds between "listening" and
// "answering", not as a substitute for that ordering.

import { INSTANCE_ID_ENV, SERVICE_NAME, instanceRefusal } from '../lib/content/identity';
import { BASE_URL } from './support/base-url';

/** Long enough for a cold start behind `next build`, short enough to fail fast. */
const DEADLINE_MS = 60_000;
const INTERVAL_MS = 500;

interface HealthBody {
  readonly service?: unknown;
  readonly status?: unknown;
  readonly instance?: unknown;
}

/**
 * What was found, in a sentence somebody woken at 02:00 can act on.
 *
 * NAMING THE PORT AND THE SUSPECT is the whole value. "Health check failed"
 * sends a reader to this file; "found a server that is not frontalier on
 * 3000 - another project?" sends them to `docker ps`, which is where the
 * answer was.
 */
function refuse(found: string, rule = 'R169'): never {
  throw new Error(
    [
      '',
      `${rule}: the e2e suite refused to run.`,
      '',
      `  expected  ${SERVICE_NAME} at ${BASE_URL}`,
      `  found     ${found}`,
      '',
      '  Something other than this product is answering on that port, or',
      '  it answered without the stylesheets that make its pages real.',
      '  Is another project\'s server or container publishing it?',
      '    docker ps --format "{{.Image}} {{.Ports}}"',
      '',
      `  To run this suite elsewhere: FRONTALIER_PORT=3100 pnpm test:e2e`,
      '',
      '  This check exists because the suite once ran a full pass against a',
      '  different application and reported 91 tests passed. An absence',
      '  assertion is satisfied by absence, so a 404 page passes every',
      '  overflow check the suite makes.',
      '',
    ].join('\n'),
  );
}

/**
 * A token every compiled stylesheet of this product declares.
 *
 * R177 asks for "a known token declaration" rather than merely non-empty CSS,
 * because non-empty proves a file arrived and says nothing about whose it is.
 */
const TOKEN = '--colour-brand';

/**
 * RULING R177: THE PAGE UNDER TEST HAS STYLES, asserted before anything else
 * is asserted about it.
 *
 * R169's presence corollary applied to CSS. R169 settles WHOSE server is
 * answering; this settles that what it served is the real page rather than an
 * unstyled shell - and the two failures look nothing alike from inside a
 * suite. A page whose CSS failed to load still renders every element, still
 * carries every string, and still satisfies every assertion this suite makes
 * about content. What it stops satisfying is anything about layout, and the
 * geometric assertions R148 added would fail with numbers that look like a
 * design regression rather than a missing file.
 *
 * COUNTING <link> TAGS IS NOT THE CHECK. A tag pointing at a 404, or at a
 * file the build emptied, leaves the page exactly as unstyled while the tag
 * is still there to count. So the sheet is FETCHED, asserted NON-EMPTY, and
 * asserted to carry a token this product declares.
 */
async function assertStyled(): Promise<void> {
  const response = await fetch(BASE_URL, { cache: 'no-store' });
  const html = await response.text();
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(
    (match) => match[1] ?? '',
  );

  if (hrefs.length === 0) refuse('HTML with no <link rel="stylesheet"> at all', 'R177');

  let bytes = 0;
  let carriesToken = false;

  for (const href of hrefs) {
    const sheet = await fetch(href.startsWith('http') ? href : `${BASE_URL}${href}`, {
      cache: 'no-store',
    });

    if (!sheet.ok) refuse(`a stylesheet that did not load: HTTP ${String(sheet.status)} ${href}`, 'R177');

    const css = await sheet.text();

    bytes += css.length;
    if (css.includes(TOKEN)) carriesToken = true;
  }

  if (bytes === 0) refuse(`${String(hrefs.length)} stylesheet link(s) totalling 0 bytes`, 'R177');

  if (!carriesToken) {
    refuse(
      `${String(hrefs.length)} stylesheet(s), ${String(bytes)} bytes, none declaring ${TOKEN}`,
      'R177',
    );
  }
}

export default async function globalSetup(): Promise<void> {
  const url = `${BASE_URL}/api/health`;
  const started = Date.now();
  let last = 'nothing - no response before the deadline';

  while (Date.now() - started < DEADLINE_MS) {
    try {
      const response = await fetch(url, { cache: 'no-store' });

      if (!response.ok) {
        // A 404 here is the foreign-app case, and it is terminal rather than
        // worth retrying: our own server answers this route as soon as it
        // answers anything.
        refuse(`HTTP ${String(response.status)} at ${url}`);
      }

      const body = (await response.json()) as HealthBody;

      if (typeof body.service !== 'string') {
        refuse(`a JSON body at ${url} with no "service" field`);
      }

      if (body.service !== SERVICE_NAME) {
        refuse(`a server identifying as "${body.service}"`);
      }

      // RULING R301: the right PRODUCT is not yet the right INSTANCE. When this
      // run set FRONTALIER_INSTANCE_ID, the server it started echoes it; a
      // sibling of this same product does not, and is refused BY NAME here
      // rather than passing R169 and 503-ing on a token it cannot verify
      // (FW33). With no expectation set this is a no-op, so warm reuse of our
      // own server on an ordinary run is untouched.
      const mismatch = instanceRefusal(process.env[INSTANCE_ID_ENV], body.instance);

      if (mismatch !== null) refuse(mismatch, 'R301');

      await assertStyled();

      return;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('\nR169')) throw error;

      last = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }

  refuse(last);
}
