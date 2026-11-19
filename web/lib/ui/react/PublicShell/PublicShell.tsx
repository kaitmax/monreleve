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
// A SERVER COMPONENT SINCE FW-CALC-BYTES (R976), AND THE REASON IS BYTES.
// Until then this whole file was 'use client', so everything it imported
// shipped to every public page: the route registry - every registered route,
// with its status, gate, task and sitemap weight - the footer's columns, the
// legal sentence and the review date. On the calculator, the page with the
// least GATE A headroom, a new route entry anywhere cost bytes (QUEUE-STATE
// BLOCKED 11). So the shell is split where the browser is actually needed:
//
//   here, on the server   WHAT the navigation contains: R85's liveness, R54's
//                         gate and R172's offer, decided against the registry;
//                         the markup that never changes after it is sent; the
//                         footer, which has nothing interactive in it at all
//   ShellNav.tsx          the interactive leaves, handed the RESOLVED entries
//                         as plain data: the Calculateurs disclosure (state),
//                         aria-current on both lists (the router's path), and
//                         the phone menu's Escape (a key handler)
//
// The rendered HTML is the same as before, element for element; what changed
// is which of it hydrates. `pnpm size` fails any build whose client chunks
// carry the registry (scripts/client-registry-leak.mjs).
//
// NO CONTEXT AND NO STORE (FW9 protocol item 5). The leaves hold one useState
// boolean and one ref each, and the native disclosure holds its own state.
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

import { Menu } from 'lucide-react';
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
import { CurrentNavMenu, MenuTrigger, MobileMenuList } from './ShellNav';
import { SignInLink } from './SignInLink';
import styles from './PublicShell.module.scss';

// THE LEAVES THE TESTS AND THE WORKBENCH RENDER DIRECTLY, re-exported so this
// stays the one place the shell is imported from. They are client components;
// importing them through a server module keeps them client references.
export { NavItem, NavMenu } from './ShellNav';

export interface PublicShellProps {
  readonly children: React.ReactNode;
  /**
   * Every published guide, for the footer's Guides column (FW33, H10).
   *
   * A PROP, AND REQUIRED. It became one because this used to be a client
   * component and the guide registry reads content/ from disk, so the pages
   * that render the shell - server components - pass guideNavLinks() from
   * lib/guides/registry.ts. The shell renders on the server now and could read
   * it itself; moving that read inside would change every call site's
   * contract, which FW-CALC-BYTES does not do. Required rather than defaulted:
   * a default of [] would render a footer with no guides and no error, and a
   * call site that forgot the prop would look finished. As it is, forgetting
   * it is a type error.
   */
  readonly guideLinks: readonly NavLink[];
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
//
// RESOLVED HERE, ON THE SERVER, AND HANDED TO THE LEAVES AS DATA (R976): the
// two lists in ShellNav.tsx receive exactly these entries and decide nothing.
const NAV: readonly NavEntry[] = collapseLoneDisclosures(visibleNav(SHELL_NAV));

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
  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          {/* THE PHONE MENU, AND IT NEEDS NO SCRIPT (FW-SHELL-BURGER).

              It was a useState disclosure from FW9 until that task: the panel
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
              reveals the navigation before the navigation.

              RENDERED ON THE SERVER SINCE FW-CALC-BYTES. Escape is the one
              part that needs a script, and MenuTrigger (ShellNav.tsx) adds it
              to this element from its summary. */}
          <details className={styles.menu}>
            <MenuTrigger label={SHELL_COPY.menuOpen}>
              <Menu aria-hidden="true" />
            </MenuTrigger>

            {/* The SAME list as the desktop bar, so the two cannot drift, and
                ALWAYS RENDERED - the disclosure hides it, not a branch.

                ITS OWN ACCESSIBLE NAME. The desktop nav is also in the
                document at this width (display:none, so out of the tree in a
                browser) and shares the landmark role; two navigations called
                the same thing is a defect the moment a stylesheet fails. */}
            <nav
              className={styles.mobilePanel}
              data-mobile-panel
              aria-label={SHELL_COPY.menuNavLabel}
            >
              <MobileMenuList entries={NAV}>
                <li>
                  <a className={styles.mobileAction} href={MENU_ACTION.href}>
                    {MENU_ACTION.label}
                  </a>
                </li>
              </MobileMenuList>
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
            <CurrentNavMenu entries={NAV} />
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

          {/* FW-WEB-ACCOUNT (R901): the way into the account area, OUTSIDE the
              phone panel like the CTA, and after it, as the A2 header draws
              "Se connecter" after the nav. A server component like this shell;
              it renders nothing while the area is not live (R85). */}
          <SignInLink />
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
