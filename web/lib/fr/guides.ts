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

  /**
   * FD13’s closing card, which ends every guide with no variants.
   *
   * IT OFFERS THE CALCULATOR, not the releve. FD13’s own rule says
   * "exactly two calculator CTAs: the inline card mid-article and the
   * closing card", while its example copy for that card points at
   * /releve-annuel. SPEC 9.5 settles it - every guide links a calculator
   * twice - and /releve-annuel is planned for FW20, so the other reading
   * would link a page that 404s.
   */
  ctaTitle: 'Savoir ou vous en etes, en une minute',
  ctaBody:
    'Le calculateur reprend vos jours de teletravail et vous dit combien il ' +
    'vous en reste avant chaque seuil. Gratuit, sans inscription.',
  ctaAction: 'Calculer mes jours',

  /** FD13: the article footer, above the related guides. */
  sourcesNote:
    'Chaque regle citee sur cette page renvoie a son texte d’origine.',
  sourcesLink: 'Voir les sources reglementaires',

  /** FD13: GUIDES LIES, the related list. */
  relatedHeading: 'Guides lies',

  /** The hub. SPEC 14: a description that says what the set is for. */
  hubDescription:
    'Les guides de reference sur le teletravail frontalier' +
    n(':') +
    ' les deux seuils, ' +
    'les jours de mission, l’attestation de l’employeur et le droit d’option.',
  hubIntro:
    'Chaque guide porte sa date de derniere verification et renvoie aux textes ' +
    'd’origine. Ils se lisent separement, dans l’ordre qui vous arrange.',

  /**
   * SPEC 9.5’s three roles, as headings a reader understands - the
   * frontmatter calls them pillar, cluster and canton because that is what
   * the MESH calls them, and a reader has never heard of a cluster.
   */
  groupTitle: {
    pillar: 'L’essentiel',
    cluster: 'Les questions precises',
    canton: 'Par canton',
  } as const,

  /** FD13: the article’s FAQ block, before the closing card. */
  faqHeading: 'Questions frequentes',
} as const;
