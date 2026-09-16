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

import { APP_NAME } from '../lib/fr';
import { BASE_URL } from './support/base-url';

/** Long enough for a cold start behind `next build`, short enough to fail fast. */
const DEADLINE_MS = 60_000;
const INTERVAL_MS = 500;

interface HealthBody {
  readonly service?: unknown;
  readonly status?: unknown;
}

/**
 * What was found, in a sentence somebody woken at 02:00 can act on.
 *
 * NAMING THE PORT AND THE SUSPECT is the whole value. "Health check failed"
 * sends a reader to this file; "found a server that is not frontalier on
 * 3000 - another project?" sends them to `docker ps`, which is where the
 * answer was.
 */
function refuse(found: string): never {
  throw new Error(
    [
      '',
      'R169: the e2e suite refused to run.',
      '',
      `  expected  ${APP_NAME} at ${BASE_URL}`,
      `  found     ${found}`,
      '',
      '  Something other than this product is answering on that port.',
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

      if (body.service !== APP_NAME) {
        refuse(`a server identifying as "${body.service}"`);
      }

      return;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('\nR169')) throw error;

      last = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }

  refuse(last);
}
