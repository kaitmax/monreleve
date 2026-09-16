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
  reviewedOn: (date: string): string => `Dernière vérification${n(':')} ${date}`,

  /**
   * FD13's second chip, and RULING R160 decides what it says: "the chip
   * states the status, not a name."
   *
   * IT USED TO BE reviewedBy(reviewer), rendering "Relu par l’equipe
   * frontalier" on every article. That sentence claims review by someone.
   * The someone was us, and a reader has no way to tell it apart from the
   * expert review these pages have NOT had - which is the distinction the
   * whole /sources page exists to draw.
   *
   * It is the same rule CLAUDE.md holds on the releve, one surface over:
   * declare, record, timestamp - never certify, attest or conform. A chip
   * that says who read it is the guide-shaped version of "certifie".
   *
   * NOT A FUNCTION, deliberately. The old signature took a name because it
   * rendered one; a constant cannot be handed a reviewer, so the field
   * cannot leak back into the chip by someone passing it again.
   */
  expertReview: `Relecture experte${n(':')} en attente`,

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
  ctaTitle: 'Savoir où vous en êtes, en une minute',
  ctaBody:
    'Le calculateur reprend vos jours de télétravail et vous dit combien il ' +
    'vous en reste avant chaque seuil. Gratuit, sans inscription.',
  ctaAction: 'Calculer mes jours',

  /**
   * FD13'S INLINE CARD, the sentence that sits left of the button.
   *
   * ONE LINE, which is the brief's wording and a layout instruction as much
   * as a copy one: the card carries a sentence, not a paragraph. A second
   * sentence turns a card that interrupts the reading into one that competes
   * with it.
   *
   * IT NAMES THE MOMENT RATHER THAN THE PRODUCT. SPEC 9.5 places this card
   * "at the moment the reader realises they cannot do the math", so the
   * sentence says exactly that and leaves the promise to the button.
   *
   * IT IS A STANDING OFFER, NOT A REMARK ABOUT THE PARAGRAPH ABOVE IT, and
   * the first version got that wrong in a way worth recording. It lifted the
   * pillar's own lead-in - "Entre la base retenue par votre employeur, les
   * demi-journées et les jours de mission, le calcul cesse vite d'être
   * faisable de tête" - which is the best sentence any of the seven had and
   * is true in exactly one of them. On the droit d'option guide that card
   * lands directly under a paragraph explaining that the telework threshold
   * has NO EFFECT on the choice being discussed, and then explains telework
   * arithmetic. One constant rendered in seven articles has to be true in
   * all seven; a sentence that reads as a reply to the text above it is only
   * true where it was written.
   *
   * Found by cropping the regenerated baseline and reading the card in place
   * (R135) - every suite was green with the wrong sentence in it.
   *
   * A QUESTION, because that is what the reader is holding at this point in
   * any of the seven, and it leaves the promise to the button beside it.
   *
   * NO FIGURE (R147): the thresholds belong to the year's RuleSet, and this
   * is a constant that cannot reach one.
   */
  inlineCtaBody: `Où en êtes-vous de vos jours de télétravail${n('?')}`,

  /** FD13: the article footer, above the related guides. */
  sourcesNote:
    'Chaque règle citée sur cette page renvoie à son texte d’origine.',
  sourcesLink: 'Voir les sources réglementaires',

  /** FD13: GUIDES LIES, the related list. */
  relatedHeading: 'Guides liés',

  /** The hub. SPEC 14: a description that says what the set is for. */
  hubDescription:
    'Les guides de référence sur le télétravail frontalier' +
    n(':') +
    ' les deux seuils, ' +
    'les jours de mission, l’attestation de l’employeur et le droit d’option.',
  hubIntro:
    'Chaque guide porte sa date de dernière vérification et renvoie aux textes ' +
    'd’origine. Ils se lisent séparément, dans l’ordre qui vous arrange.',

  /**
   * SPEC 9.5’s three roles, as headings a reader understands - the
   * frontmatter calls them pillar, cluster and canton because that is what
   * the MESH calls them, and a reader has never heard of a cluster.
   */
  groupTitle: {
    pillar: 'L’essentiel',
    cluster: 'Les questions précises',
    canton: 'Par canton',
  } as const,

  /** FD13: the article’s FAQ block, before the closing card. */
  faqHeading: 'Questions fréquentes',
} as const;
