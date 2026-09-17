// web/scripts/lighthouse.mjs
//
// `pnpm lighthouse`, with a site origin, an identity check, and three runs.
//
// WHY THIS FILE EXISTS, and it is a measurement rather than a preference.
// R152 asks for a Lighthouse FLOOR on the first real guide. Run without a
// configured origin, the pillar scores SEO 63 and the failing audit is
// exactly one:
//
//   is-crawlable - Page is blocked from indexing
//
// That is ruling R81 working correctly, not a defect. With no origin there is
// no canonical, and the article route answers by refusing indexing rather than
// by publishing a canonical pointing at localhost. So a floor measured in that
// state would be a floor on a page the product deliberately hides, and it
// would sit at 63 for a reason that has nothing to do with the article.
//
// With an origin, the same page scores 100 in all four categories. THAT is the
// number worth holding.
//
// THE ORIGIN IS THE ONE THE E2E SUITE ALREADY USES, for the reason
// playwright.config.ts states: .example is reserved by RFC 2606, it can never
// resolve, and it cannot be mistaken for the real domain - which is still an
// open question gated at Checkpoint C.
//
// NEXT_PUBLIC_SITE_URL IS INLINED AT BUILD, not read at serve, so it has to be
// present for `next build` rather than for `next start`. So this script builds
// FIRST, with the origin, and only then starts what was built.
//
// A NODE WRAPPER RATHER THAN AN INLINE ASSIGNMENT because `VAR=x cmd` is shell
// syntax that Windows does not have, and this repository is developed on
// Windows and built on Linux.
//
// ---------------------------------------------------------------------------
// RULING R174: A SAMPLED MEASUREMENT GETS A BETTER SAMPLE, NEVER A LOOSER GATE
//
// FW20's floor failed once at 0.99 on /guides/geneve with numberOfRuns: 1, and
// passed on re-run. R114's no-tolerance rule governs BASELINES, where a diff
// means something changed; Lighthouse is a sampled measurement of a machine
// under load, so 0.01 is noise. The answer is three runs and the median, with
// the floor unchanged at 100 - not a widened band.
//
// AND THE SERVER IS OURS BEFORE ANYTHING IS MEASURED. This script now starts
// the server itself rather than handing lighthouserc a startServerCommand,
// because a check that runs after `lhci autorun` has already collected is a
// check that reports on numbers it cannot retract.
//
// FW20 measured the cost of not having this in the e2e suite: pointed at
// another project's container, 91 tests passed. Lighthouse had the same hole -
// a hardcoded port and no idea what answered on it - and would have reported a
// performance score for somebody else's application without a word.
// ---------------------------------------------------------------------------

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * RFC 2606. Reserved, unresolvable, unmistakable for the real domain.
 *
 * It matters more since FW20c than it did: monreleve.ch is a domain that
 * could actually resolve, so a typo in the TLD would point a measurement
 * run at production rather than at nothing.
 */
const ORIGIN = JSON.parse(readFileSync(new URL('../identity.json', import.meta.url), 'utf8'))
  .testOrigin;

/** R170: the port comes from the environment, so two projects can coexist. */
const PORT = process.env.FRONTALIER_PORT ?? process.env.PORT ?? '3000';
const BASE = `http://localhost:${PORT}`;

/**
 * A token every compiled stylesheet of this product declares.
 *
 * R177 asks for "a known token declaration" rather than merely non-empty CSS,
 * because non-empty proves a file arrived and nothing about whose it is.
 */
const TOKEN = '--colour-brand';

/**
 * The product's own name, as /api/health reports it.
 *
 * READ FROM identity.json RATHER THAN TYPED, and FW20c is why. R189 says
 * the service field and R169’s guard change in ONE commit, because a
 * rename that moves one and not the other either refuses the correct
 * server or accepts any server at all. There turned out to be THREE
 * copies, not two: e2e/global-setup.ts imports the constant, and this
 * file had a literal of its own - so a rename that satisfied R189 as
 * written would still have left every Lighthouse run refusing.
 *
 * A .mjs script cannot import the TypeScript that derives the name from
 * APP_NAME, so identity.json is the transport. It is a transcription, and
 * R185 says a transcription is asserted rather than argued:
 * tests/unit/content/identity.test.ts pins this file against the derived
 * value.
 */
const SERVICE = JSON.parse(readFileSync(new URL('../identity.json', import.meta.url), 'utf8'))
  .service;

const ROUTES = ['/', '/guides', '/guides/teletravail-frontalier-40-pourcent', '/guides/geneve'];

const env = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? ORIGIN,
};

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true, env });

  if (result.status !== 0) process.exit(result.status ?? 1);
};

/** What was found, in a sentence somebody woken at 02:00 can act on. */
function refuse(what, found) {
  console.error('');
  console.error(`R174: lighthouse refused to measure - ${what}.`);
  console.error('');
  console.error(`  expected  ${SERVICE} at ${BASE}`);
  console.error(`  found     ${found}`);
  console.error('');
  console.error('  Something other than this product is answering on that port,');
  console.error('  or it is answering without its stylesheets.');
  console.error('    docker ps --format "{{.Image}} {{.Ports}}"');
  console.error('');
  console.error(`  To measure elsewhere: FRONTALIER_PORT=3100 pnpm lighthouse`);
  console.error('');
  console.error('  A score for the wrong page is worse than no score: it is a');
  console.error('  number somebody will quote.');
  console.error('');
  process.exit(1);
}

/**
 * R174: whose server is this.
 *
 * A STATUS CODE IS NOT ENOUGH, and FW20 proved it twice. The foreign container
 * that captured port 3000 answered /api/health with 200 and valid JSON of its
 * own; so did the one that later captured 3100. Only the `service` field
 * distinguishes them.
 */
async function assertOurs() {
  const deadline = Date.now() + 90_000;
  let last = 'nothing - no response before the deadline';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`, { cache: 'no-store' });

      if (!response.ok) refuse('the health route did not answer', `HTTP ${response.status}`);

      const body = await response.json();

      if (body.service !== SERVICE) {
        refuse('the server is not this product', `a server identifying as "${body.service}"`);
      }

      return;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  refuse('the server never answered', last);
}

/**
 * R177: the page under measurement actually has styles.
 *
 * THE SAME QUESTION AS R174, ONE LAYER DOWN. R174 asks whether the right
 * application is answering; this asks whether what it served is the real page
 * rather than an unstyled shell. A Lighthouse run against a page whose CSS
 * failed to load reports a PERFECT performance score and a plausible
 * accessibility one - there is almost nothing to paint - and every number is
 * meaningless.
 *
 * It is the absence-satisfied-by-absence shape that R169's corollary names,
 * arriving in the one tool that measures how fast a page paints.
 */
async function assertStyled() {
  const response = await fetch(BASE, { cache: 'no-store' });
  const html = await response.text();

  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(
    (match) => match[1],
  );

  if (hrefs.length === 0) {
    refuse('the page served no stylesheet', 'HTML with zero <link rel="stylesheet">');
  }

  // FETCHED, NON-EMPTY, AND CARRYING A KNOWN TOKEN. Counting <link> tags is
  // not the check R177 asks for: a tag pointing at a 404, or at a file the
  // build emptied, leaves the page exactly as unstyled while the tag is still
  // there to count. The token declaration is what proves the file is THIS
  // product's compiled stylesheet rather than any non-empty CSS.
  let carriesToken = false;
  let bytes = 0;

  for (const href of hrefs) {
    const sheet = await fetch(href.startsWith('http') ? href : `${BASE}${href}`, {
      cache: 'no-store',
    });

    if (!sheet.ok) refuse('a stylesheet did not load', `HTTP ${sheet.status} for ${href}`);

    const css = await sheet.text();

    bytes += css.length;
    if (css.includes(TOKEN)) carriesToken = true;
  }

  if (bytes === 0) refuse('every stylesheet was empty', `${hrefs.length} link(s), 0 bytes`);

  if (!carriesToken) {
    refuse(
      'no stylesheet carried a known design token',
      `${hrefs.length} link(s), ${bytes} bytes, none declaring ${TOKEN}`,
    );
  }

  console.log(
    `lighthouse: ${BASE} is ${SERVICE}, ${hrefs.length} stylesheet(s), ` +
      `${bytes} bytes, ${TOKEN} present`,
  );
}

console.log(`lighthouse: building with NEXT_PUBLIC_SITE_URL=${env.NEXT_PUBLIC_SITE_URL}`);
run('pnpm', ['build']);

/**
 * NOTHING MAY ALREADY BE ON THE PORT, and this check exists because the first
 * version of this script created the problem it now refuses.
 *
 * `spawn(..., { shell: true })` gives back the PID of the SHELL, so
 * server.kill() killed cmd.exe and left `next start` running. The orphan then
 * served a build whose CSS the next build had replaced - and the run after it
 * failed R177 with "HTTP 400 for /_next/static/css/<old hash>.css", which
 * reads like a broken stylesheet and was really a stale server.
 *
 * That is R98's orphan-container problem one layer down, and the honest fix is
 * both halves: refuse a busy port loudly, and kill the whole process tree.
 */
async function assertPortFree() {
  try {
    const response = await fetch(`${BASE}/api/health`, { cache: 'no-store' });

    refuse(
      'something is already serving that port',
      `HTTP ${response.status} from an existing server - an orphan of a previous run, ` +
        'or another project',
    );
  } catch {
    // Connection refused is the good case: nothing is there.
  }
}

await assertPortFree();

console.log(`lighthouse: starting the server on ${PORT}`);
const server = spawn('pnpm', ['exec', 'next', 'start', '-p', PORT], {
  stdio: 'ignore',
  shell: true,
  env,
});

/**
 * KILL THE TREE, NOT THE SHELL. server.pid is cmd.exe under shell:true, and
 * killing it leaves `next start` holding the port - the orphan this script
 * spent a run diagnosing.
 */
const stop = () => {
  if (server.pid === undefined) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else if (!server.killed) {
    server.kill();
  }
};

process.on('exit', stop);
process.on('SIGINT', () => {
  stop();
  process.exit(130);
});

await assertOurs();
await assertStyled();

// The URLs are built from the port rather than read from lighthouserc, for
// R171's reason: the config's list would be a literal standing in for "the
// routes on the server this script just started".
run('lhci', ['autorun', ...ROUTES.map((route) => `--collect.url=${BASE}${route}`)]);

stop();
