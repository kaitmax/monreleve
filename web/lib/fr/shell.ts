// web/lib/fr/shell.ts
//
// Every word the public shell renders. SPEC section 5: user-facing strings
// come from lib/fr only.
//
// THE NAV IS DATA, NOT MARKUP. Four items, one of them a disclosure with two
// children (FW9 increment 4). Declaring them as a list rather than writing
// four <li>s means the desktop header renders a loop and the mobile panel
// renders the SAME loop, so the two cannot drift - which matters because the
// mobile panel is the half nobody looks at during a desktop review.
//
// NO "CONNEXION". D14: there is no signup and no signed-in web area, so a
// login link would be an entry point to nothing. SPEC 9.2's header diagram
// still shows one; that diagram is stale and the prompt is explicit.
//
// TODO-COPY: realistic French, not reviewed.

/** A leaf nav item: a label and where it goes. */
export interface NavLink {
  readonly label: string;
  readonly href: string;
}

/** A nav entry: either a link, or a disclosure carrying children. */
export interface NavEntry {
  readonly label: string;
  readonly href?: string;
  readonly children?: readonly NavLink[];
}

import { APP_NAME } from '@/lib/fr';

export const SHELL_COPY = {
  /**
   * The accessible name of the home link. The mark beside APP_NAME is
   * decorative and aria-hidden, and a link announced as only the product name
   * does not say where it goes.
   */
  homeLabel: `${APP_NAME}, accueil`,

  /** <nav aria-label>. A second nav arrives with the footer, so it is named. */
  navLabel: 'Navigation principale',

  /** The mobile disclosure trigger: a 44x44 icon button still needs a name. */
  menuOpen: 'Ouvrir le menu',
  menuClose: 'Fermer le menu',

  /** <footer> is a landmark too, and two navs need two names. */
  footerNavLabel: 'Navigation de pied de page',

  /**
   * RULING R51. Shown while LAST_REGULATORY_REVIEW is null, which is until
   * the operator records the Checkpoint A human gate. It carries NO DIGITS,
   * asserted by test: any number in this sentence could be misread as the
   * date it exists to avoid printing.
   */
  reviewPending: 'Vérification réglementaire en cours',

  /**
   * Shown once a review is recorded. Takes the date ALREADY FORMATTED by
   * formatDate - Swiss dots, from an ISO day (R28) - because assembling a
   * date here would be a second answer to how this product writes one.
   *
   * It names what the date means: "29.04.2026" alone in a footer is
   * ambiguous between published, updated and reviewed.
   */
  // CONCATENATION, NOT A TEMPLATE LITERAL, and the reason is a lint rule
  // rather than taste. eslint's no-irregular-whitespace has skipStrings: true
  // by default but skipTemplates: FALSE, so the mandated U+00A0 before the
  // colon is legal in an ordinary string and an error inside a backtick one.
  // FW11's typography pass hit exactly that here - the only template literal
  // in lib/fr that gained a no-break space.
  //
  // Concatenating keeps the raw codepoint in the source, which matters: the
  // copy-codepoints registry counts characters in the FILE, so writing it as
  // a \u00A0 escape instead would make the source scan miss it while the
  // runtime value stayed correct - a registry that under-reports is worse
  // than none.
  reviewDone: (date: string): string =>
    'Dernière vérification réglementaire : ' + date,

  /** The single primary action. D14: it leads to the app, not to a signup. */
  cta: 'Suivre mes jours',
  ctaHref: '/application',
} as const;

export const SHELL_NAV: readonly NavEntry[] = [
  {
    label: 'Calculateurs',
    children: [
      { label: 'Calculateur de télétravail', href: '/calculateur-teletravail-frontalier' },
      { label: 'Comparateur LAMal / CMU', href: '/calculateur-lamal-cmu' },
    ],
  },
  { label: 'Guides', href: '/guides' },
  { label: 'Le relevé', href: '/releve-annuel' },
  { label: 'Tarifs', href: '/tarifs' },
];

// ---------------------------------------------------------------------------
// THE FOOTER
// ---------------------------------------------------------------------------
//
// WHICH DISCLAIMER, decided by the prompt's own precedence rule rather than by
// preference. SPEC 9.1:650 says the footer carries "the standing disclaimer in
// $legal-01" - which is LEGAL_COPY.standing, the four-clause sentence LegalNote
// renders. FD11:93 prints a different, much shorter line. FW9's reading
// instruction is "the spec wins on conflict", so the footer reuses $legal-01
// and the briefs' shorter sentence is recorded as a deviation. It also means
// the disclaimer has ONE home: a second wording would be a second promise.
//
// THE SITEMAP IS DATA HERE AND WILL MOVE. FW10 increment 5 builds
// lib/content/routes.ts as "one source for every public URL", feeding the
// sitemap, robots and this footer alike. Until then these four columns are the
// only declaration, and the hrefs must match SHELL_NAV's - a test asserts the
// overlap rather than trusting it.

export interface FooterColumn {
  readonly heading: string;
  readonly links: readonly NavLink[];
}

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    heading: 'Outils',
    links: [
      { label: 'Calculateur de télétravail', href: '/calculateur-teletravail-frontalier' },
      { label: 'Comparateur LAMal / CMU', href: '/calculateur-lamal-cmu' },
    ],
  },
  {
    heading: 'Guides',
    links: [
      { label: 'Tous les guides', href: '/guides' },
      // R147/R153: THE LABEL NAMES THE RULE, THE SLUG KEEPS THE FIGURE.
      // It read "Le seuil de 40 %" until FW18b. The slug may keep the number
      // because SPEC 14 freezes slugs permanently - a stronger rule than this
      // one - but nothing freezes an anchor's text, so in 2028 this footer
      // would have offered a threshold that no longer exists.
      //
      // "Le plafond fiscal" is the article's own breadcrumbLabel, so the
      // footer and the breadcrumb now agree on what the page is called.
      //
      // IT COSTS THE FIGURE AS ANCHOR TEXT, which is a real SEO trade and the
      // reason to state it: the term survives in the slug, the article title
      // and the h1, which are the stronger signals. Reversible in one string.
      { label: 'Le plafond fiscal', href: '/guides/teletravail-frontalier-40-pourcent' },
    ],
  },
  {
    heading: 'Le produit',
    links: [
      { label: 'Le relevé', href: '/releve-annuel' },
      { label: "L’application", href: '/application' },
      { label: 'Tarifs', href: '/tarifs' },
    ],
  },
  {
    heading: 'Légal',
    links: [
      { label: 'Mentions légales', href: '/mentions-legales' },
      { label: 'Confidentialité', href: '/confidentialite' },
      { label: "Conditions d’utilisation", href: '/cgu' },
      { label: 'Sources', href: '/sources' },
    ],
  },
];
