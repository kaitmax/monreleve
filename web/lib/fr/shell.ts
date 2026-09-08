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

export const SHELL_COPY = {
  /**
   * The accessible name of the home link. The mark beside APP_NAME is
   * decorative and aria-hidden, and a link announced as only the product name
   * does not say where it goes.
   */
  homeLabel: 'frontalier, accueil',

  /** <nav aria-label>. A second nav arrives with the footer, so it is named. */
  navLabel: 'Navigation principale',

  /** The mobile disclosure trigger: a 44x44 icon button still needs a name. */
  menuOpen: 'Ouvrir le menu',
  menuClose: 'Fermer le menu',

  /** The single primary action. D14: it leads to the app, not to a signup. */
  cta: 'Suivre mes jours',
  ctaHref: '/application',
} as const;

export const SHELL_NAV: readonly NavEntry[] = [
  {
    label: 'Calculateurs',
    children: [
      { label: 'Calculateur de télétravail', href: '/calculateur-teletravail-frontalier' },
      { label: 'Comparateur LAMal / CMU', href: '/comparateur-lamal-cmu' },
    ],
  },
  { label: 'Guides', href: '/guides' },
  { label: 'Le relevé', href: '/releve' },
  { label: 'Tarifs', href: '/tarifs' },
];
