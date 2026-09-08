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

  // Linting is `pnpm lint` (eslint + stylelint) and a blocking CI step of its
  // own. Next's built-in pass would run ESLint a second time, with a different
  // configuration surface, and is deprecated in 15.5. One authority, not two.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
