// web/app/dev/rail-parity/page.tsx
//
// The seam for increment 5's Node-versus-browser byte comparison, and nothing
// else. It renders no rail: it exposes renderRailSvg so a Playwright test can
// call it IN PAGE CONTEXT and receive the RETURN VALUE.
//
// WHY THE RETURN VALUE AND NEVER THE DOM. Measured: for an SVG string
// containing U+00A0 in its aria-label, setting innerHTML and reading
// outerHTML back gives a string that differs from the input - U+00A0 comes
// back as the six-character entity &nbsp;. A comparison that round-trips
// through the DOM therefore compares the browser's re-serialisation against
// Node's generator and would report a difference that does not exist, or hide
// one that does. page.evaluate returns the string across CDP untouched.
//
// /dev/** is noindex, out of the sitemap, and excluded from the size budget
// by scripts/check-budgets.mjs (isGated), so this route cannot affect a
// public gate. app/dev/composants is the existing precedent.

'use client';

import { useEffect } from 'react';
import { renderRailSvg } from '@/lib/ui/core/rail/renderRailSvg';
import type { RailData } from '@/lib/ui/core/rail/geometry';
import type { ZoneThresholds } from '@/lib/ui/core/zones';

declare global {
  interface Window {
    __renderRailSvg?: (data: RailData, thresholds: ZoneThresholds) => string;
    __railParityReady?: boolean;
  }
}

export default function RailParityPage() {
  useEffect(() => {
    window.__renderRailSvg = (data, thresholds) => renderRailSvg(data, thresholds);
    window.__railParityReady = true;
  }, []);

  return <main data-testid="rail-parity" />;
}
