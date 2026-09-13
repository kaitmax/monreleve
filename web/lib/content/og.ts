// web/lib/content/og.ts
//
// The social card, as the metadata layer needs to name it.
//
// WHY A MODULE FOR FOUR VALUES. Every one of them exists somewhere else
// already and would otherwise be retyped at the call site: the dimensions
// belong to the rail generator, the alt text is the card's own accessible
// name, and the path is a file on disk. A literal in app/(public)/layout.tsx
// would be a fourth copy that nothing compares against the first three - and
// a path typo there is invisible to every test that reads the metadata,
// because the tags would be well formed and the card would simply 404 in a
// crawler nobody is watching.
//
// THE PATH IS SERVED FROM public/, NOT FROM app/. Next's metadata file
// convention would emit og:image and twitter:image by itself, resolved
// against metadataBase - which is the localhost stand-in until Checkpoint C
// decides the domain. Measured in FW15 increment 1: the head of every public
// page carried http://localhost:3000/opengraph-image.png, and
// e2e/guard.runtime.spec.ts caught it. R81 applies to a card URL exactly as
// it applies to a canonical, and the convention has no conditional form, so
// the card is a static asset and the tags are declared behind
// canonicalsAvailable().

import { RAIL_SOCIAL_ARIA } from '@/lib/fr/rail';
import { SOCIAL_HEIGHT, SOCIAL_WIDTH } from '@/lib/ui/core/rail/geometry';

export const OG_CARD = {
  /** Root-relative. Next resolves it against metadataBase. */
  path: '/opengraph-image.png',
  type: 'image/png',
  width: SOCIAL_WIDTH,
  height: SOCIAL_HEIGHT,
  /**
   * The SVG's own aria-label, so the description a screen reader hears and
   * the one a social platform publishes are the same string and cannot drift
   * from each other or from the picture.
   */
  alt: RAIL_SOCIAL_ARIA,
} as const;
