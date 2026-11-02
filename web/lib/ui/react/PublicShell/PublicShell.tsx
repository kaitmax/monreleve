'use client';

// web/lib/ui/react/PublicShell/PublicShell.tsx
//
// The public header, and the shell its children sit in. FW9 increment 4;
// increment 5 adds the footer beneath the same children slot.
//
// PLAIN <a href> THROUGHOUT, NEVER next/link - RULING R87, and the reason is
// recorded here because this is the file someone would change.
//
// Public routes are statically rendered and hold no client state, so a
// client-side transition would buy nothing a browser navigation does not
// already give. next/link would add prefetch JavaScript to every page for
// transitions nobody asked for, which is a GATE B cost on the acquisition
// surface - and it would PREFETCH HIDDEN ROUTES, which is the worse half: the
// calculator is deliberately invisible until the Checkpoint A gate is recorded
// (R54), and a prefetching nav would fetch it anyway.
//
// tests/unit/meta/no-next-link.test.ts pins the absence.
//
// 'use client' AND WHY IT IS UNAVOIDABLE HERE. Two disclosures hold state -
// the Calculateurs menu and the mobile panel - and both must close on Escape
// and return focus, which needs a ref and a key handler. This is the
// interactive leaf the code style permits it at. The children it wraps are
// untouched and stay server-rendered, so a page's own content pays nothing for
// this.
//
// NO CONTEXT AND NO STORE (FW9 protocol item 5): two useState booleans and one
// ref each. Nothing here is shared with anything.
//
// THE NAV IS RENDERED FROM DATA, TWICE. lib/fr/shell.ts declares four entries
// and the desktop bar and the mobile panel both loop over the same list. Two
// hand-written copies would drift, and the one that drifts is the mobile
// panel, because a desktop review never opens it.
//
// THE CTA IS OUTSIDE THE PANEL, deliberately and structurally. FD2's mobile
// header keeps it visible beside the hamburger: the single action the header
// exists to offer must not be hidden behind a menu. A test asserts the CTA is
// not a descendant of the panel rather than asserting it "looks visible",
// because in jsdom the latter passes either way.
//
// IT EMITS NO h1. The page owns that (protocol item 8); a shell that emitted
// one would give every page two.

import { ChevronDown, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import {
  collapseLoneDisclosures,
  ctaHrefIfOffered,
  visibleFooterColumns,
  visibleNav,
} from '@/lib/content/routes';
import { APP_NAME } from '@/lib/fr';
import { LAST_REGULATORY_REVIEW, reviewNotice } from '@/lib/content/regulatory';
import { LEGAL_COPY } from '@/lib/fr/legal';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { FOOTER_COLUMNS, MENU_ACTION, SHELL_COPY, SHELL_NAV } from '@/lib/fr/shell';
import type { FooterColumn, NavEntry, NavLink } from '@/lib/fr/shell';
import styles from './PublicShell.module.scss';

export interface PublicShellProps {
  readonly children: React.ReactNode;
  /**
   * Every published guide, for the footer's Guides column (FW33, H10).
   *
   * A PROP, AND REQUIRED, because this is a client component and the guide
   * registry reads content/ from disk. The pages that render the shell are
   * server components and pass guideNavLinks() from lib/guides/registry.ts.
   * Required rather than defaulted: a default of [] would render a footer
   * with no guides and no error, and a call site that forgot the prop would
   * look finished. As it is, forgetting it is a type error.
   */
  readonly guideLinks: readonly NavLink[];
}

/** FD11: the Calculateurs caret, Lucide chevron-down at a 1.75 stroke. */
const STROKE = 1.75;

/**
 * One nav entry: a link, or a disclosure holding links.
 *
 * The disclosure closes on Escape and puts focus back on its own trigger.
 * Without that, closing the panel drops focus to <body> and a keyboard user is
 * silently returned to the top of the document.
 *
 * EXPORTED SINCE FW33, for one reason: no disclosure ships today, because
 * Calculateurs has one live child and renders as a link to it. The disclosure
 * branch still exists and returns on its own the day a second child goes
 * live, so the test suite and the workbench render it directly - it is the
 * only way its keyboard behaviour and its caret stay proven meanwhile.
 */
/**
 * FW-CALCS-A2: aria-current="page" on the link to the page being read, and on
 * nothing else. The header is the shell's; this task marks the current page
 * and adds no menu. An exact match only - a guide is not "the guides hub".
 */
function currentFor(href: string | undefined, pathname: string | null): 'page' | undefined {
  return href !== undefined && pathname !== null && href === pathname ? 'page' : undefined;
}

export function NavItem({
  entry,
  pathname = null,
}: {
  readonly entry: NavEntry;
  /** The current path, so the link to it is marked aria-current (FW-CALCS-A2). */
  readonly pathname?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  if (entry.children === undefined) {
    return (
      <li className={styles.navItem}>
        <a className={styles.navLink} href={entry.href} aria-current={currentFor(entry.href, pathname)}>
          {entry.label}
        </a>
      </li>
    );
  }

  return (
    <li
      className={styles.navItem}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) close();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.navLink}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {entry.label}
        {/* ONLY HERE, never on a plain link: a caret promises a menu, and
            the lone-child link is not one. */}
        <ChevronDown className={styles.chevron} aria-hidden="true" strokeWidth={STROKE} />
      </button>

      {/* Rendered only when open, rather than hidden with CSS: a panel that
          stays in the tree is reachable by Tab while invisible, which is the
          keyboard trap version of this component's whole risk. */}
      {open ? (
        <ul className={styles.submenu}>
          {entry.children.map((child) => (
            <li key={child.href}>
              <a className={styles.navLink} href={child.href} aria-current={currentFor(child.href, pathname)}>
                {child.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * RULING R85's answer for this render, AND R172's.
 *
 * Module scope, because it depends only on the route registry and the
 * product-state module - not on props, not on state - and computing it per
 * render would suggest otherwise.
 *
 * TWO CONDITIONS, AND FW20b IS WHY THE SECOND ONE EXISTS. R85 asks whether
 * the TARGET EXISTS; this button also has to ask whether the THING IT
 * PROMISES exists. It reads "Suivre mes jours", and /application went live
 * in FW20b as a page describing an application that is not built. On the
 * registry check alone, that flip would have switched on a prominent button
 * on every public page offering a reader day-tracking the product cannot do
 * - a promise, not a broken link, which is the worse of the two because
 * nothing 404s and nothing looks wrong.
 *
 * THE SECOND CONDITION IS trackerExists, NOT appExists (R186, FW33b). The
 * button promises TRACKING - "Suivre mes jours" - so the thing it promises is
 * a released app a person can actually record a day with, which is precisely
 * what trackerExists names (SPEC 8; flipped at AN14, and only once BOTH a
 * release and the entries path exist). appExists is weaker: an app can be
 * released and still not let anyone record a day, and gating on it alone would
 * put the promise back on every page one step too early. Both flags are false
 * today, so nothing renders either way - the distinction bites the day an app
 * ships before its tracker does, which is the exact gap R186 exists for.
 *
 * IT IS EXACTLY THE DISTINCTION lib/content/product-state.ts calls
 * load-bearing: A PAGE EXISTING IS NOT THE THING EXISTING. /releve-annuel
 * has been live since FW20 with dossierExists false for the same reason.
 *
 * FOUND BY A TEST WRITTEN TO FIND IT. The singleton census asserted this
 * button renders zero times while the target is planned, and its comment
 * said: "the day /application ships, this fails and says the count has to be
 * reconsidered rather than silently becoming 1." It did, and it did.
 */
const ctaHref = ctaHrefIfOffered(SHELL_COPY.ctaHref, PRODUCT_STATE.trackerExists);

/**
 * RULING R54's third surface, computed at module scope for the same reason
 * ctaHref is: it depends only on the route registry and the review constant.
 *
 * While the Checkpoint A review is null, a gated route is absent from the nav
 * and the footer - not merely noindex. Being linked from every page while
 * asking not to be indexed is how a page gets indexed anyway. The review was
 * recorded on 09.09.2026, so nothing is filtered today; the closed branch is
 * proved directly in tests/unit/content/regulatory-gate.test.ts rather than
 * through this component, because the constant cannot be varied from here.
 */
//
// THEN LONE DISCLOSURES COLLAPSE (FW33, H4). A menu left with one live child
// is a link to that child, under the child's own label - so today the header
// offers "Calculateur de télétravail" by name rather than a one-item menu.
const NAV: readonly NavEntry[] = collapseLoneDisclosures(visibleNav(SHELL_NAV));

/**
 * The desktop nav's list, exported for the workbench's disclosure specimen so
 * the specimen is styled by this file rather than by a copy of it.
 */
export function NavMenu({
  entries,
  pathname = null,
}: {
  readonly entries: readonly NavEntry[];
  readonly pathname?: string | null;
}) {
  return (
    <ul className={styles.navList}>
      {entries.map((entry) => (
        <NavItem key={entry.label} entry={entry} pathname={pathname} />
      ))}
    </ul>
  );
}

/**
 * The footer's columns, with the published guides appended to the one column
 * that holds them, then filtered by the same R85/R54 rule as the rest.
 */
function footerColumns(guideLinks: readonly NavLink[]): readonly FooterColumn[] {
  return visibleFooterColumns(
    FOOTER_COLUMNS.map((column) =>
      column.guides === true ? { ...column, links: [...column.links, ...guideLinks] } : column,
    ),
  );
}

export function PublicShell({ children, guideLinks }: PublicShellProps) {
  // NO STATE FOR THE MENU ANY MORE: details/summary owns "open", so React
  // holding a second copy of it would be two answers to one question. The ref
  // exists only for Escape, which is a progressive enhancement - with no
  // script the disclosure still opens, closes and reports itself correctly.
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  const closeMenu = useCallback(() => {
    const element = menu.current;

    if (element === null || !element.open) return;

    element.open = false;
    // Focus goes back to the summary, not to <body>: closing a panel and
    // dropping focus to the top of the document is the keyboard trap this
    // component has been guarded against since FW9.
    element.querySelector('summary')?.focus();
  }, []);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          {/* THE PHONE MENU, AND IT NEEDS NO SCRIPT (FW-SHELL-BURGER).

              It was a useState disclosure from FW9 until this task: the panel
              was `{menuOpen ? <div/> : null}`, so with scripting off the button
              was inert and a phone reader had no navigation at all. Every gate
              passed, because jsdom runs the handler and Playwright's default
              context runs the script - neither environment can see it.

              details/summary is the browser's own disclosure: open state,
              keyboard operation and the expanded state it reports to a screen
              reader are all native, and the panel's links are in the markup
              whether or not the script arrives. design/home's phone view draws
              exactly this.

              THE NAME DOES NOT CHANGE WITH THE STATE, and that is the one
              thing given up. The button used to rename itself "Fermer le
              menu"; a summary cannot, without the script this exists to do
              without. It costs nothing a reader relies on: the browser
              announces expanded/collapsed from the element itself, which is
              more than a swapped label ever told anyone.

              The hamburger sits FIRST in the DOM, which is where FD2 draws it
              and also the order a screen reader should meet it: the thing that
              reveals the navigation before the navigation. */}
          <details
            ref={menu}
            className={styles.menu}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeMenu();
            }}
          >
            <summary className={styles.menuButton} aria-label={SHELL_COPY.menuOpen}>
              <Menu aria-hidden="true" />
            </summary>

            {/* The SAME list as the desktop bar, so the two cannot drift, and
                ALWAYS RENDERED - the disclosure hides it, not a branch. The
                nested menu is flattened: on a phone a menu inside a menu is
                two taps to reach a link.

                ITS OWN ACCESSIBLE NAME. The desktop nav is also in the
                document at this width (display:none, so out of the tree in a
                browser) and shares the landmark role; two navigations called
                the same thing is a defect the moment a stylesheet fails. */}
            <nav
              className={styles.mobilePanel}
              data-mobile-panel
              aria-label={SHELL_COPY.menuNavLabel}
            >
              <ul className={styles.mobileList}>
                {NAV.flatMap((entry) =>
                  entry.children !== undefined
                    ? entry.children.map((child) => (
                        <li key={child.href}>
                          <a
                            className={styles.mobileLink}
                            href={child.href}
                            aria-current={currentFor(child.href, pathname)}
                          >
                            {child.label}
                          </a>
                        </li>
                      ))
                    : [
                        <li key={entry.href}>
                          <a
                            className={styles.mobileLink}
                            href={entry.href}
                            aria-current={currentFor(entry.href, pathname)}
                          >
                            {entry.label}
                          </a>
                        </li>,
                      ],
                )}
                <li key={MENU_ACTION.href}>
                  <a className={styles.mobileAction} href={MENU_ACTION.href}>
                    {MENU_ACTION.label}
                  </a>
                </li>
              </ul>
            </nav>
          </details>

          <a className={styles.home} href="/" aria-label={SHELL_COPY.homeLabel}>
            {/* The brand lockup (mon-releve-logo kit), replacing the FW9
                placeholder mark + text. An <img> rather than inline SVG so the
                mark's two brand colours stay in the .svg asset and out of this
                component - the token rule forbids a raw hex in .tsx. Decorative
                (alt=""), because the link already carries its accessible name
                through aria-label; the mark is not announced twice, which is
                why the placeholder was aria-hidden. */}
            <img className={styles.lockup} src="/logo-lockup.svg" alt="" />
            {/* The product name stays in the DOM as text, visually hidden: the
                lockup shows it, but a name living only inside a picture is lost
                to SEO and to a reader who cannot load the image. */}
            <span className="u-visually-hidden">{APP_NAME}</span>
          </a>

          <nav className={styles.nav} aria-label={SHELL_COPY.navLabel}>
            <NavMenu entries={NAV} pathname={pathname} />
          </nav>

          {/* OUTSIDE the panel below, on every viewport - and rendered ONLY
              when its target exists (ruling R85). /application is SPEC 9.1's
              page and no task builds it, so until then this button would have
              been a prominent link to a 404 on every public page. An absent
              button is a smaller failure than a broken one, and the decision
              is the registry's rather than a thing to remember: marking the
              route live turns it back on with no code change here. */}
          {ctaHref === null ? null : (
            <a className={styles.cta} href={ctaHref}>
              {SHELL_COPY.cta}
            </a>
          )}
        </div>

      </header>

      {children}

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          {/* The brand lockup as the footer sign-off, decorative. NOT a link:
              a second home link would add a duplicate destination to every
              page's header/footer link census (e2e/routing.spec.ts). alt=""
              for the same reason the header mark is decorative. */}
          <img className={styles.footerLogo} src="/logo-lockup.svg" alt="" />
          <nav className={styles.columns} aria-label={SHELL_COPY.footerNavLabel}>
            {footerColumns(guideLinks).map((column) => (
              <div className={styles.column} key={column.heading}>
                <h2 className={styles.columnHeading}>{column.heading}</h2>
                <ul className={styles.columnList}>
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <a className={styles.footerLink} href={link.href}>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* THE SAME sentence LegalNote renders. SPEC 9.1:650 puts
              $legal-01 in the footer, and FD11 prints a shorter line -
              the prompt says the spec wins on conflict, and one wording
              means one promise. */}
          <p className={styles.disclaimer}>{LEGAL_COPY.standing(PRODUCT_STATE)}</p>

          {/* RULING R51. The constant, and nothing a caller chose: there is
              no prop here on purpose, because a prop would be the channel
              through which a date that has not happened could reach the
              page. Null renders the in-progress sentence. */}
          <p className={styles.review}>{reviewNotice(LAST_REGULATORY_REVIEW)}</p>
        </div>
      </footer>
    </>
  );
}
