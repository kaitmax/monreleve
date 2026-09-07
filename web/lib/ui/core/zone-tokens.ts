// web/lib/ui/core/zone-tokens.ts
//
// The Zone -> band colour and Status -> badge visual mappings, and nothing
// else.
//
// WHY THIS IS A SEPARATE FILE. It has no runtime imports, so
// scripts/generate-zones-scss.mjs can load it directly under
// `node --experimental-strip-types` and read the mappings as data. The import
// below is type-only and is erased before Node ever sees the file. zones.ts
// cannot be loaded that way: it pulls French copy in from lib/fr through the
// "@/" alias, which Node does not resolve, and adding a resolver hook or a
// TypeScript runner to the build to work around that would be tooling bought
// to solve a problem the layering should not have. An SCSS generator has no
// business loading French copy. So the design-token mapping is data with no
// dependencies, here, and zones.ts joins it to copy for the badge.
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
export type LucideIconName = string;

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
