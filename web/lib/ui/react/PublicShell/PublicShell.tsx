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

import { Menu, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { ctaHrefIfLive, visibleFooterColumns, visibleNav } from '@/lib/content/routes';
import { APP_NAME } from '@/lib/fr';
import { LAST_REGULATORY_REVIEW, reviewNotice } from '@/lib/content/regulatory';
import { LEGAL_COPY } from '@/lib/fr/legal';
import { FOOTER_COLUMNS, SHELL_COPY, SHELL_NAV } from '@/lib/fr/shell';
import type { NavEntry } from '@/lib/fr/shell';
import styles from './PublicShell.module.scss';
import { Wordmark } from './Wordmark';

export interface PublicShellProps {
  readonly children: React.ReactNode;
}

/**
 * One nav entry: a link, or a disclosure holding links.
 *
 * The disclosure closes on Escape and puts focus back on its own trigger.
 * Without that, closing the panel drops focus to <body> and a keyboard user is
 * silently returned to the top of the document.
 */
function NavItem({ entry }: { readonly entry: NavEntry }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  if (entry.children === undefined) {
    return (
      <li className={styles.navItem}>
        <a className={styles.navLink} href={entry.href}>
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
      </button>

      {/* Rendered only when open, rather than hidden with CSS: a panel that
          stays in the tree is reachable by Tab while invisible, which is the
          keyboard trap version of this component's whole risk. */}
      {open ? (
        <ul className={styles.submenu}>
          {entry.children.map((child) => (
            <li key={child.href}>
              <a className={styles.navLink} href={child.href}>
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
 * RULING R85's answer for this render. Module scope, because it depends only
 * on the route registry - not on props, not on state - and computing it per
 * render would suggest otherwise.
 */
const ctaHref = ctaHrefIfLive(SHELL_COPY.ctaHref);

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
const NAV = visibleNav(SHELL_NAV);
const FOOTER = visibleFooterColumns(FOOTER_COLUMNS);

export function PublicShell({ children }: PublicShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuTrigger.current?.focus();
  }, []);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          {/* The hamburger sits FIRST in the DOM, which is where FD2 draws it
              and also the order a screen reader should meet it: the thing that
              reveals the navigation before the navigation. */}
          <button
            ref={menuTrigger}
            type="button"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? SHELL_COPY.menuClose : SHELL_COPY.menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && menuOpen) closeMenu();
            }}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>

          <a className={styles.home} href="/" aria-label={SHELL_COPY.homeLabel}>
            <span className={styles.mark}>
              <Wordmark />
            </span>
            <span className={styles.name}>{APP_NAME}</span>
          </a>

          <nav className={styles.nav} aria-label={SHELL_COPY.navLabel}>
            <ul className={styles.navList}>
              {NAV.map((entry) => (
                <NavItem key={entry.label} entry={entry} />
              ))}
            </ul>
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

        {menuOpen ? (
          <div
            className={styles.mobilePanel}
            data-mobile-panel
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeMenu();
            }}
          >
            {/* The SAME list as the desktop bar, so the two cannot drift. The
                disclosure is expanded here rather than nested: on a phone a
                menu inside a menu is two taps to reach a link. */}
            <ul className={styles.mobileList}>
              {NAV.flatMap((entry) =>
                entry.children !== undefined
                  ? entry.children.map((child) => (
                      <li key={child.href}>
                        <a className={styles.mobileLink} href={child.href}>
                          {child.label}
                        </a>
                      </li>
                    ))
                  : [
                      <li key={entry.href}>
                        <a className={styles.mobileLink} href={entry.href}>
                          {entry.label}
                        </a>
                      </li>,
                    ],
              )}
            </ul>
          </div>
        ) : null}
      </header>

      {children}

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <nav className={styles.columns} aria-label={SHELL_COPY.footerNavLabel}>
            {FOOTER.map((column) => (
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
          <p className={styles.disclaimer}>{LEGAL_COPY.standing}</p>

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
