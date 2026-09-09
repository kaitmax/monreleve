// web/lib/ui/core/zone-tokens.ts
//
// The Zone -> band colour and Status -> badge visual mappings, and nothing
// else.
//
// THE SINGLE SOURCE for the Zone mapping (ruling R38). The rail reads
// ZONE_BAND_TOKEN directly; the badge reads STATUS_VISUAL. There is no
// generated stylesheet any more - _zones.scss existed to carry this mapping
// into CSS, gained no consumer, and was removed rather than kept alive by its
// own stale-check.
//
// WHY IT IS STILL A SEPARATE FILE FROM zones.ts. It has no runtime imports at
// all: the import below is type-only and erased at build time. That began as
// a mechanical requirement - the deleted generator loaded this file under
// `node --experimental-strip-types`, which zones.ts cannot support because it
// pulls French copy through the "@/" alias - and it survives the generator
// because dependency-free data is the right shape for the thing every other
// layer joins onto: the rail, the badge, and the Compose port (D20) which
// must transcribe these pairs and nothing else.
//
// SPEC 6.2: TWO MAPS, NEVER ONE. The rail is coloured by Zone and the badge
// by Status - colouring the rail by Status is a review rejection. 'compliant'
// and 'social-switch' are members of BOTH unions, so a single record keyed on
// the bare literal would conflate the two axes and TypeScript would not
// complain, because the key types overlap.
//
// Every value here is a TOKEN NAME. No file under lib/ui/core carries a
// colour; the names resolve against lib/ui/core/styles/tokens.scss, and a
// test looks each one up in the compiled output so a typo fails rather than
// rendering nothing.

import type { Status, Zone } from './zones';

/**
 * A Lucide icon name in kebab-case, which is the form DESIGN-SYSTEM.md and
 * the Android port both use. lucide-react keys its icons in PascalCase, so
 * the React layer converts at FW8; a test asserts every name here resolves to
 * a real Lucide icon, because a typo renders an empty badge rather than an
 * error.
 */
/**
 * The Lucide icons this product actually uses, as a union.
 *
 * WAS `string`, which gave no safety at all - a mistyped name compiled and
 * rendered nothing, so FW6 predicted a TEST would catch it and FW8 wrote one.
 * That test still exists and still checks these names against lucide-react,
 * which is the half a type cannot do.
 *
 * NARROWED WHEN THE BADGE STOPPED USING A RUNTIME LOOKUP. ZoneBadge imported
 * the whole icon library as a namespace and indexed it by this string, which
 * defeated tree-shaking and cost 207 KiB the moment the badge reached a gated
 * route (R2, FW12). The fix is four named imports in a static map, and that
 * map can only be exhaustive if this is a union rather than string - so the
 * bundling fix and the stronger type are the same edit.
 *
 * Adding a status now needs an icon HERE and an import in ZoneBadge, both
 * checked by tsc.
 */
export type LucideIconName = 'circle-check' | 'triangle-alert' | 'circle-x' | 'octagon-alert';

/** The presentation half of a badge: what it looks like, with no words. */
export interface StatusVisual {
  readonly icon: LucideIconName;
  /** A DESIGN-SYSTEM.md token name. Never a hex - this module has no colours. */
  readonly colourToken: string;
  readonly softColourToken: string;
}

export const STATUS_VISUAL: Record<Status, StatusVisual> = {
  compliant: {
    icon: 'circle-check',
    colourToken: '--colour-success',
    softColourToken: '--colour-success-soft',
  },

  // The warning badge on the green band (SPEC 6.2). Success here would make
  // the badge agree with the rail and the exposure invisible.
  'mission-exposure': {
    icon: 'triangle-alert',
    colourToken: '--colour-warning',
    softColourToken: '--colour-warning-soft',
  },

  'regime-lost': {
    icon: 'circle-x',
    colourToken: '--colour-error',
    softColourToken: '--colour-error-soft',
  },

  // A distinct glyph from regime-lost, deliberately. Only three status
  // colours exist for four statuses (SPEC 12), so these two necessarily share
  // --colour-error; if they shared the icon as well, the badge would look
  // identical for "you lost the tax regime" and "your social security
  // affiliation moves", flattening two different legal consequences into one
  // picture - and FW8's "four badge states visually distinct" would be
  // unachievable by anything but the label. Raised in the report as a design
  // choice.
  'social-switch': {
    icon: 'octagon-alert',
    colourToken: '--colour-error',
    softColourToken: '--colour-error-soft',
  },
};

/**
 * Zone to band colour (SPEC 6.2): the three bands are coloured success /
 * warning / error, in that order.
 */
export const ZONE_BAND_TOKEN: Record<Zone, string> = {
  compliant: '--colour-success',
  'fiscal-exposure': '--colour-warning',
  'social-switch': '--colour-error',
};
