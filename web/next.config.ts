// web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ONE URL PER PAGE, WITHOUT THE TRAILING SLASH.
  //
  // The choice barely matters; having made it and enforced it matters a great
  // deal. Two URLs answering 200 for the same page splits link equity, and
  // SPEC 14 wants self-referencing canonicals, which cannot be self-
  // referencing if both forms serve. No-slash is the shorter form and the one
  // every href in lib/content/routes.ts already carries.
  //
  // `false` is also Next's default. It is stated ANYWAY, because a default is
  // a decision nobody made: the day someone sets it to true to fix a
  // deployment quirk, this comment is what they read first. The redirect from
  // the slashed form is Next's own, and it is a 308 rather than the 301 the
  // prompt names - 308 is the permanent redirect that preserves the method,
  // Next emits it for slash normalisation, `permanent: true` in a redirects()
  // rule emits 308 too, and search engines treat the two identically. A
  // literal 301 would have to come from the reverse proxy. Noted in the report
  // as a deviation; the Playwright assertion accepts either and says so.
  trailingSlash: false,

  // RULING R98: a baseline is valid only from an ISOLATED build. The visual
  // runner sets this to a unique directory per run, so a container's build can
  // never be the one another process is reading or writing. Unset everywhere
  // else, which is every ordinary build.
  //
  // Belt and braces with the anonymous volume scripts/visual.mjs already
  // mounts over .next: the volume is that script's implementation detail,
  // while distDir travels with the build itself and survives a future
  // simplification of the docker invocation.
  ...(process.env.NEXT_DIST_DIR === undefined ? {} : { distDir: process.env.NEXT_DIST_DIR }),

  // RULING R129: /dev/** IS NOT IN THE PRODUCTION BUILD.
  //
  // WHY, MEASURED. FW12 added /dev/island, a client-cost harness that renders
  // the whole component library inside a 'use client' boundary so GATE I can
  // see what each component drags into a browser bundle. It works - it catches
  // the 207 KiB regression the workbench provably cannot - and it cost the
  // CALCULATOR 1,0 KiB and every other public route 0,2. Next chunks globally,
  // so a second client entry importing the same modules regroups what every
  // route loads. A dev harness was spending the public budget.
  //
  // pageExtensions IS THE MECHANISM because it is the only one that keeps the
  // files where they are. The dev pages are named `page.dev.tsx`, which Next
  // treats as a page only when `dev.tsx` is an accepted page extension. With
  // the flag unset they are ordinary modules that no route resolves to, so
  // nothing imports them, so nothing they import is in the graph - which is
  // what "pays nothing" has to mean when the cost was chunk grouping rather
  // than bytes on a page.
  //
  // NOT A SEPARATE APP, NOT A DELETED DIRECTORY. The workbench's baselines and
  // the parity harness have to keep working, so the same tree builds both ways
  // and the flag decides. CI runs one dev-enabled build to measure GATE W and
  // GATE I; the production build ships neither route.
  pageExtensions:
    process.env.FRONTALIER_DEV_ROUTES === '1'
      ? ['tsx', 'ts', 'dev.tsx']
      : ['tsx', 'ts'],

  // Linting is `pnpm lint` (eslint + stylelint) and a blocking CI step of its
  // own. Next's built-in pass would run ESLint a second time, with a different
  // configuration surface, and is deprecated in 15.5. One authority, not two.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
