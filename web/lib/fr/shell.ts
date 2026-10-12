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

  /**
   * The phone panel's own landmark name (FW-SHELL-BURGER).
   *
   * NOT "Navigation principale", which the desktop bar already carries. Both
   * are in the document at every width - the one that does not apply is
   * display:none, so a browser keeps it out of the accessibility tree - and
   * two navigation landmarks announced by the same name is a defect the
   * moment a stylesheet fails to load, which is the state this whole task is
   * about.
   */
  menuNavLabel: 'Menu principal',

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

// ---------------------------------------------------------------------------
// THE TOOLS, ONE HOME EACH (R206, FW33b)
// ---------------------------------------------------------------------------
//
// The two calculators appear TWICE in this file - in the nav's Calculateurs
// menu and in the footer's Outils column. Until FW33b each was typed in both
// places, and a test ("agrees with the header") compared the two labels to keep
// them in step. R206: where two surfaces must say the same thing, ONE holds it
// and the other references it - not two strings a test compares, because that
// test only proves they were equal when somebody last looked. So each tool is
// one object now, referenced by both lists; a drift is not caught, it is
// impossible.
const TELEWORK_CALCULATOR: NavLink = {
  label: 'Calculateur de télétravail',
  href: '/calculateur-teletravail-frontalier',
};
const LAMAL_COMPARATOR: NavLink = {
  label: 'Comparateur LAMal / CMU',
  href: '/calculateur-lamal-cmu',
};

export const SHELL_NAV: readonly NavEntry[] = [
  {
    label: 'Calculateurs',
    children: [TELEWORK_CALCULATOR, LAMAL_COMPARATOR],
  },
  { label: 'Guides', href: '/guides' },
  { label: 'Le relevé', href: '/releve-annuel' },
  { label: 'Tarifs', href: '/tarifs' },
];

/**
 * The phone menu's own action, below the desktop navigation's destinations.
 *
 * FW-SHELL-BURGER adds it: the desktop bar offers the calculator as a nav
 * entry and, when `appExists` is true, the CTA beside it; the phone panel has
 * neither until it is opened, so the one thing a reader came to do is named at
 * the foot of the list.
 *
 * THE LABEL IS NEW COPY; THE HREF IS NOT. It is TELEWORK_CALCULATOR's own
 * path, read from the object the nav and the footer already share, so the
 * menu cannot come to point somewhere else than the navigation above it
 * (R206). SPEC 14 freezes that slug, which is exactly why it is not retyped.
 */
export const MENU_ACTION: NavLink = {
  label: 'Calculer ma situation',
  href: TELEWORK_CALCULATOR.href,
};

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
  /**
   * Set on the one column that also lists every published guide (FW33, H10).
   *
   * THE GUIDES ARE NOT DECLARED HERE, and that is the point of the flag. SPEC
   * 9.2 makes the footer the full sitemap; each article already names itself
   * in its breadcrumbLabel, and typing seven of those names here would be
   * seven transcriptions (R181). The registry derives them - guideNavLinks()
   * in lib/guides/registry.ts - and the pages hand them to PublicShell, which
   * appends them after this column's own links.
   */
  readonly guides?: true;
}

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    heading: 'Outils',
    links: [
      // THE SAME TWO OBJECTS the nav references (R206) - see TELEWORK_CALCULATOR
      // and LAMAL_COMPARATOR above. One home, so the nav and the footer cannot
      // disagree on a label or an href.
      TELEWORK_CALCULATOR,
      LAMAL_COMPARATOR,
      // FW33: live since FW14 and linked from nowhere but the calculator's
      // result panel. FD11 section 7 files it here.
      { label: 'Alertes e-mail', href: '/alertes' },
    ],
  },
  {
    heading: 'Guides',
    guides: true,
    // R147/R153 STILL HOLD, and now mechanically. Until FW33 this column
    // carried one typed link, "Le plafond fiscal" - the pillar's own
    // breadcrumbLabel, retyped here so that the footer and the breadcrumb
    // agreed on the name. They agreed because somebody kept them in step. The
    // label now IS the breadcrumbLabel, read from the article, so the name
    // cannot drift and never carries a figure the article does not.
    links: [{ label: 'Tous les guides', href: '/guides' }],
  },
  {
    heading: 'Le produit',
    links: [
      { label: 'Le relevé', href: '/releve-annuel' },
      { label: "L’application", href: '/application' },
      { label: 'Tarifs', href: '/tarifs' },
      // FW33: live since FW20, the page whose subject is who has checked the
      // rules - and it was linked from no page's footer.
      { label: 'À propos', href: '/a-propos' },
      // MOVED FROM Légal IN FW33, to where FD11 section 7 files it. The
      // register of sources is part of what the product is, not a legal page.
      { label: 'Sources', href: '/sources' },
    ],
  },
  {
    heading: 'Légal',
    links: [
      { label: 'Mentions légales', href: '/mentions-legales' },
      { label: 'Confidentialité', href: '/confidentialite' },
      { label: "Conditions d’utilisation", href: '/cgu' },
    ],
  },
];
