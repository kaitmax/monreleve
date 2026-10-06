// web/app/(public)/verifier/[code]/page.tsx
//
// The public verification page. FW-VERIFY (R330).
//
// ============================================================================
// WHAT IT IS, AND WHAT IT DELIBERATELY IS NOT
// ============================================================================
//
// Releves get photographed, forwarded and left in shared folders, and whoever
// holds one can scan its code. So this page is PUBLIC and its job is to CONFIRM
// a document - never to reveal anything new. It shows only what is printed on the
// releve (lookupVerification selects exactly those columns), and NEVER the email
// or the account.
//
// NO COOKIES (FW22's rule, reiterated for this page), NO CLIENT JS, noindex. It
// is force-dynamic because it rate-limits per request and reads one row; a
// static page could do neither.
//
// UNKNOWN AND WITHDRAWN ARE ONE ANSWER, BY ONE PATH. Both resolve to a null view
// through the same lookup, so there is no difference in content or timing between
// "never existed" and "erased" (R330).

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { checkRate, clientKey } from '@/lib/alerts/rate-limit';
import { lookupVerification } from '@/lib/verification/lookup';
import { VERIFICATION_COPY } from '@/lib/fr/verification';
import { VerificationContent, type VerificationState } from './VerificationContent';

export const dynamic = 'force-dynamic';

/**
 * NOINDEX. A verification URL carries one person's code and resolves to their
 * figures; it must never reach an index, and nocache/noarchive stop a crawler
 * that ignored the first word from keeping the second.
 */
export const metadata: Metadata = {
  title: VERIFICATION_COPY.title,
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
};

/**
 * The verification endpoint's rate ceiling, per client address.
 *
 * HIGHER THAN THE ALERT FORM'S FIVE, because a fiduciaire may legitimately scan
 * several documents in a sitting, and LOW enough that bulk guessing is useless -
 * though the real defence against guessing is the 128-bit code, not this. It is
 * a backstop that makes a scripted sweep expensive (lib/alerts/rate-limit.ts).
 */
const VERIFY_RATE_LIMIT = 30;

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<React.ReactElement> {
  const requestHeaders = await headers();
  const decision = checkRate(clientKey(requestHeaders), Date.now(), VERIFY_RATE_LIMIT);

  let state: VerificationState;

  if (!decision.allowed) {
    state = { kind: 'rate-limited' };
  } else {
    const { code } = await params;
    const view = await lookupVerification(code);

    state = view === null ? { kind: 'unknown' } : { kind: 'found', view };
  }

  return <VerificationContent state={state} />;
}
