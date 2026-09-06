// web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Linting is `pnpm lint` (eslint + stylelint) and a blocking CI step of its
  // own. Next's built-in pass would run ESLint a second time, with a different
  // configuration surface, and is deprecated in 15.5. One authority, not two.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
