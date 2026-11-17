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
//
// A DATABASE THAT CANNOT BE REACHED IS A THIRD ANSWER (FW-VERIFIER-OUTAGE, R1022
// as amended by Web Ruling 20). The heading and one sentence - verification is
// temporarily unavailable - and nothing about the code or the document: the page
// looked nothing up. It answers 200, because Next 15.5 gives a page no 503
// (404/403/401, a redirect, 500 or 200 are the only statuses it can produce), so
// the CONTENT is what tells this answer apart. It is never cached as the page's
// answer: force-dynamic (below) sends every answer of this route with
// `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`,
// read off the degraded answer itself by the container step. Only the causes on
// the allow-list take this path (lib/verification/database-unreachable.ts);
// every other error is thrown on, as before, and answers the framework's 500.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { checkRate, clientKey } from '@/lib/alerts/rate-limit';
import { describeUnreachable, isDatabaseUnreachable } from '@/lib/verification/database-unreachable';
import { lookupVerification, type VerificationView } from '@/lib/verification/lookup';
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

/**
 * What a well-formed request resolves to, the database permitting.
 *
 * THE CATCH WRAPS THE LOOKUP AND NOTHING ELSE, so a defect in what follows it is
 * never read as an outage. Inside it, only an allow-listed cause becomes the
 * unavailable state, and the error is LOGGED with its code and the adapter's
 * cause: the degraded answer says nothing, so the log is the one record of what
 * the page got (the container step reads it).
 */
async function resolveCode(code: string): Promise<VerificationState> {
  let view: VerificationView | null;

  try {
    view = await lookupVerification(code);
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error;

    console.error(
      `[verifier] the database could not be reached (${describeUnreachable(error)}); ` +
        `answered the unavailable state: ${error.message}`,
    );

    return { kind: 'unavailable' };
  }

  return view === null ? { kind: 'unknown' } : { kind: 'found', view };
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<React.ReactElement> {
  const requestHeaders = await headers();
  // R338: ITS OWN BUCKET. The alert form (app/api/alertes/route.ts) and this page
  // both key a window by the client address. Keyed bare, they share ONE window per
  // address, so a fiduciaire scanning several releves would spend the alert form's
  // five-attempt budget, and a script hammering the alert form would refuse this
  // page - traffic on one blocking the other. The auth routes already namespace
  // for exactly this reason (app/api/v1/auth/code/route.ts: `auth:code:ip:`); this
  // page gets `verify:ip:` so the two endpoints cannot refuse one another.
  const decision = checkRate(`verify:ip:${clientKey(requestHeaders)}`, Date.now(), VERIFY_RATE_LIMIT);

  let state: VerificationState;

  if (!decision.allowed) {
    state = { kind: 'rate-limited' };
  } else {
    const { code } = await params;

    state = await resolveCode(code);
  }

  return <VerificationContent state={state} />;
}
