// web/app/dev/rail-gallery/page.tsx
//
// Every variant x zone, rendered for the screenshot baselines, plus the
// 200 px inline rail that is the Checkpoint A thumbnail-legibility artifact.
//
// A dev route: noindex, out of the sitemap, and excluded from the size gate
// by segment (scripts/check-budgets.mjs isGated). app/dev/composants and
// app/dev/spike are the precedents.
//
// IT MUST RENDER THROUGH THE REAL CASCADE. That is the whole point of taking
// the screenshots in a page rather than rasterising the string in isolation:
// the rail's colours and type are var() references, and a baseline taken
// without the token layer would be a black bar with 16 px Times - which is
// exactly what an undefined custom property renders as, silently, for every
// zone identically. app/layout.tsx loads global.scss, which @use "tokens", so
// these screenshots prove the var() references RESOLVE as well as that the
// geometry is right.
//
// dangerouslySetInnerHTML here is not the one tasks/todo.md reserves for
// FW8's ThresholdRail. This is a dev harness rendering a string the test
// suite has already proved is escaped (rail-xml.test.ts, 20 assertions
// including both break-out payloads); FW8's wrapper is the product component
// and carries its own review.

import { ruleSetFor } from '@/lib/calc-engine';
import { renderRailSvg } from '@/lib/ui/core/rail/renderRailSvg';
import type { Zone } from '@/lib/ui/core/zones';

const RULES = ruleSetFor(2026);
const THRESHOLDS = {
  fiscalCeiling: RULES.fiscalCeiling,
  socialCeiling: RULES.socialCeiling,
};

const VARIANTS = ['inline', 'compact', 'social'] as const;
const ZONES: readonly Zone[] = ['compliant', 'fiscal-exposure', 'social-switch'];

/** A rate that sits inside each band, so the fill is visible and distinct. */
const RATE: Record<Zone, number> = {
  compliant: 34.58,
  'fiscal-exposure': 45.2,
  'social-switch': 60,
};

export default function RailGalleryPage() {
  return (
    <main>
      {VARIANTS.flatMap((variant) =>
        ZONES.map((zone) => (
          <div
            key={`${variant}-${zone}`}
            data-testid={`rail-${variant}-${zone}`}
            style={{ display: 'inline-block' }}
            // eslint-disable-next-line react/no-danger -- dev harness, not product
            dangerouslySetInnerHTML={{
              __html: renderRailSvg(
                { percentage: RATE[zone], zone, width: 376, height: 8, variant },
                THRESHOLDS,
              ),
            }}
          />
        )),
      )}

      {/* The Checkpoint A artifact: can two ticks 9,9 points apart be told
          apart at a Facebook-thumbnail width? That is a question for eyes. */}
      <div
        data-testid="rail-inline-200px"
        style={{ display: 'inline-block' }}
        // eslint-disable-next-line react/no-danger -- dev harness, not product
        dangerouslySetInnerHTML={{
          __html: renderRailSvg(
            { percentage: 34.58, zone: 'compliant', width: 200, height: 8, variant: 'inline' },
            THRESHOLDS,
          ),
        }}
      />
    </main>
  );
}
