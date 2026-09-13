// web/lib/fr/guides.ts
//
// Every word the guides TEMPLATE renders. The articles' own prose lives in
// their MDX frontmatter and body - that is content, written by FW17 and FW18
// and reviewed - while these are the strings the template puts around any
// article, and they belong here like every other user-facing string.
//
// THE CHIP LABELS TAKE THEIR VALUES AS ARGUMENTS (R73), for the same reason
// the calculator's prose does: a date or a count baked into a sentence is a
// second copy of something the page already knows, and it goes stale without
// anything failing.
//
// FRENCH TYPOGRAPHY (R91): no-break spaces are built by n() rather than
// typed, so they are visible in the source.
//
// TODO-COPY: realistic French, not reviewed by counsel.

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it. */
const n = (mark: string): string => `${NB}${mark}`;

export const GUIDES_COPY = {
  hubTitle: 'Guides',

  /** The breadcrumb's accessible name. A landmark needs one to be findable. */
  breadcrumbLabel: "Fil d’Ariane",

  /**
   * FD13's first chip, and the brief puts it first on purpose: "on a subject
   * whose rules change annually, WHEN this was last checked matters more than
   * who wrote it".
   */
  reviewedOn: (date: string): string => `Derniere verification${n(':')} ${date}`,

  reviewedBy: (reviewer: string): string => `Relu par ${reviewer}`,

  /** FD13: the outline card heads itself SUR CETTE PAGE, uppercase. */
  tocLabel: 'Sur cette page',

  /** Computed from the body, never authored. */
  readingTime: (minutes: number): string => `${minutes} min de lecture`,
} as const;
