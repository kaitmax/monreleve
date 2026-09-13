// web/app/dev/og/page.tsx
//
// Where the shipped social card is rendered. e2e/og.visual.spec.ts
// photographs this page inside R37's container and the picture becomes
// public/opengraph-image.png.
//
// A DEV ROUTE, like the rail gallery and the island harness: out of the
// production build by its page.dev.tsx name, noindex, out of the sitemap, and
// excluded from the size gate by segment. The card it produces is a static
// asset, so nothing about this page reaches a user.
//
// WHY THE CARD IS RENDERED IN A PAGE AT ALL - the same reason the rail
// baselines are, and it is not a preference. renderRailSvg writes every
// colour and type value as a var() reference; without a cascade an undefined
// custom property renders BLACK at 16 px, identically and silently. Here the
// cascade is app/layout.tsx's: real tokens, and the real self-hosted Inter,
// which is the typeface the card has to be set in and the one no DOM-free
// rasteriser in the toolchain can load (public/fonts ships woff2; satori and
// resvg both refuse it).
//
// display: flex ON THE HOST, AND IT IS THE DIFFERENCE BETWEEN 630 AND 636.
// The rail gallery wraps its specimens in inline-block, which puts the SVG on
// a text baseline and leaves a descender row beneath it - its social tiles
// are 1200 x 636 PNGs of a 1200 x 630 drawing. A flex container blockifies
// its child, so the capture is the drawing and nothing else. e2e asserts the
// number rather than trusting this comment.
//
// THE RATE IS 34,58 AND IT MUST NOT APPEAR. R44 makes the social variant
// generic - no rate, no fill, no band colour - and a harness that passed a
// rate of zero could not tell a card that had started printing one from a
// card that had not. A visible number here would fail e2e/og.visual.spec.ts
// and the baseline diff both.

import { ruleSetFor } from '@/lib/calc-engine';
import { renderRailSvg } from '@/lib/ui/core/rail/renderRailSvg';
import { SOCIAL_HEIGHT, SOCIAL_WIDTH } from '@/lib/ui/core/rail/geometry';

const RULES = ruleSetFor(2026);

export default function OgCardPage() {
  return (
    <main style={{ margin: 0 }}>
      <div
        data-testid="og-card"
        style={{ display: 'flex', width: SOCIAL_WIDTH, height: SOCIAL_HEIGHT }}
        // eslint-disable-next-line react/no-danger -- dev harness, not product
        dangerouslySetInnerHTML={{
          __html: renderRailSvg(
            {
              percentage: 34.58,
              zone: 'compliant',
              width: 0,
              height: 0,
              variant: 'social',
            },
            { fiscalCeiling: RULES.fiscalCeiling, socialCeiling: RULES.socialCeiling },
          ),
        }}
      />
    </main>
  );
}
