'use client';

// web/lib/ui/react/PublicShell/ShellNav.tsx
//
// THE SHELL'S INTERACTIVE LEAVES, AND ONLY THOSE (FW-CALC-BYTES, R976).
//
// PublicShell.tsx is a server component. It decides what the navigation
// CONTAINS - R85's liveness and R54's gate, against the route registry - and
// hands the answers to these leaves as plain data. What is left here is what
// needs a browser:
//
//   NavItem / NavMenu  a disclosure holding state (useState), and the
//                      desktop list's aria-current, which needs the path
//   CurrentNavMenu     the router's path (usePathname), for the desktop list
//   MobileMenuList     the phone panel's list, with aria-current per link
//   MenuTrigger        the phone menu's trigger, which closes its disclosure
//                      on Escape and takes the focus back
//
// WHY THE SPLIT EXISTS. This file used to be the whole shell, and a client
// module ships everything it imports: the registry (every registered route),
// the footer's copy, the legal sentence and the review date reached the
// browser on every public page, and on the calculator - the page with the
// least GATE A headroom - any new route entry cost bytes (QUEUE-STATE BLOCKED
// 11). The registry must never be imported here or below; `pnpm size` fails
// the build if a client chunk carries it (scripts/client-registry-leak.mjs).
//
// NOTHING HERE DECIDES WHETHER A LINK EXISTS. Every href arrives resolved.

import { ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { NavEntry } from '@/lib/fr/shell';
import styles from './PublicShell.module.scss';

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
 * The desktop list as the shell renders it: the entries the server resolved,
 * marked against the router's path. The workbench renders NavMenu without a
 * path, which is why the path is read here and not inside NavMenu.
 */
export function CurrentNavMenu({ entries }: { readonly entries: readonly NavEntry[] }) {
  return <NavMenu entries={entries} pathname={usePathname()} />;
}

/**
 * The phone panel's list: the same entries as the desktop bar, so the two
 * cannot drift, with the nested menu flattened - on a phone a menu inside a
 * menu is two taps to reach a link. `children` is the panel's own action,
 * rendered by the server after the entries.
 */
export function MobileMenuList({
  entries,
  children,
}: {
  readonly entries: readonly NavEntry[];
  readonly children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <ul className={styles.mobileList}>
      {entries.flatMap((entry) =>
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
      {children}
    </ul>
  );
}

/**
 * The phone menu's trigger: the summary of the shell's native disclosure.
 *
 * ESCAPE IS THE ONE PART THAT IS A SCRIPT, a progressive enhancement over
 * markup that already opens, closes and reports its state with no script at
 * all (FW-SHELL-BURGER). The listener sits on the disclosure itself, the
 * trigger's parent, so Escape closes it from the trigger or from any link
 * inside the panel, and focus comes back here rather than dropping to <body> -
 * the keyboard trap this header has been guarded against since FW9.
 */
export function MenuTrigger({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  const trigger = useRef<HTMLElement>(null);

  useEffect(() => {
    const summary = trigger.current;
    const menu = summary?.parentElement;

    if (summary === null || menu === null || menu === undefined || menu.tagName !== 'DETAILS') {
      return undefined;
    }

    const disclosure = menu as HTMLDetailsElement;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !disclosure.open) return;

      disclosure.open = false;
      summary.focus();
    };

    disclosure.addEventListener('keydown', closeOnEscape);

    return () => disclosure.removeEventListener('keydown', closeOnEscape);
  }, []);

  return (
    <summary ref={trigger} className={styles.menuButton} aria-label={label}>
      {children}
    </summary>
  );
}
