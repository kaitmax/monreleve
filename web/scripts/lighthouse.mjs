// web/scripts/lighthouse.mjs
//
// `pnpm lighthouse`, with a site origin.
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
// FIRST, with the origin, and lighthouserc.json's startServerCommand only
// starts what was built.
//
// THE BUILD IS NOT IN startServerCommand, and that is measured too: lhci waits
// 30 seconds by default for the server to answer, a build takes minutes, and
// the result is not a timeout message - lhci gives up waiting and Chrome
// reports "prevented page load with an interstitial", which reads like a
// security failure and sent the first attempt looking in the wrong place.
//
// A NODE WRAPPER RATHER THAN AN INLINE ASSIGNMENT because `VAR=x cmd` is shell
// syntax that Windows does not have, and this repository is developed on
// Windows and built on Linux.

import { spawnSync } from 'node:child_process';

/** RFC 2606. Reserved, unresolvable, unmistakable for the real domain. */
const ORIGIN = 'https://frontalier.example';

const env = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? ORIGIN,
};

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true, env });

  if (result.status !== 0) process.exit(result.status ?? 1);
};

console.log(`lighthouse: building with NEXT_PUBLIC_SITE_URL=${env.NEXT_PUBLIC_SITE_URL}`);
run('pnpm', ['build']);
run('lhci', ['autorun']);
