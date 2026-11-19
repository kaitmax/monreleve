// web/lib/ui/react/PublicShell/SignInLink.tsx
//
// The header's way into the account area. FW-WEB-ACCOUNT (R901), rebuilt on
// the server-rendered shell (W12, R1064).
//
// A SERVER COMPONENT, RENDERED BY PublicShell ITSELF. C9 wrote this as a
// component handed INTO a client shell through a required prop (Queue Ruling
// 21), because the shell was 'use client' and anything it imported shipped to
// every page. Since FW-CALC-BYTES (R976) PublicShell is a server component, so
// the prop has nothing left to buy: the shell renders this link directly, the
// same way it renders the CTA, and no call site changes. ShellNav.tsx, the
// shell's only client module, must never import it.
//
// R85: null while the account area is not live (ACCOUNT_ROUTE, which derives
// from PRODUCT_STATE.webAccountExists - R172), so the link and the privacy
// notice's cookie sentence share one source.
//
// ONE anchor, two presentations (PublicShell.module.scss): on a phone an icon
// button whose name is the visually hidden text; from md the A2 pill with the
// text shown and the icon hidden. The accessible name is the same at every
// width.

import { LogIn } from 'lucide-react';
import { accountHrefIfLive } from '@/lib/content/routes';
import { SHELL_COPY } from '@/lib/fr/shell';
import styles from './PublicShell.module.scss';

/** FD11's header stroke, the one the shell's own icons use. */
const STROKE = 1.75;

export function SignInLink() {
  const href = accountHrefIfLive();

  if (href === null) return null;

  return (
    <a className={styles.signIn} href={href}>
      <LogIn className={styles.signInIcon} aria-hidden="true" strokeWidth={STROKE} />
      <span className={`u-visually-hidden ${styles.signInText}`}>{SHELL_COPY.signIn}</span>
    </a>
  );
}
