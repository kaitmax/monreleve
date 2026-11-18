// web/lib/web-account/session.ts
//
// From a request's Cookie header to a person, in one call. FW-WEB-ACCOUNT (R899).
//
// The page and every POST handler in the area ask the same question the same
// way: read the one cookie (lib/web-account/cookie.ts), resolve it against
// WebSession (lib/auth/web-session.ts). Three answers, and the third exists so
// the page can tell "never signed in" (show the form plainly) from "your
// session ended" (one sentence, whatever ended it - R210).

import { resolveWebSession } from '@/lib/auth/web-session';
import { sessionTokenFrom } from '@/lib/web-account/cookie';

export type AccountSession =
  | { readonly state: 'signed-in'; readonly userId: string; readonly sessionId: string; readonly token: string }
  | { readonly state: 'absent' }
  | { readonly state: 'ended' };

export async function accountSessionFrom(cookieHeader: string | null): Promise<AccountSession> {
  const token = sessionTokenFrom(cookieHeader);

  if (token === null) return { state: 'absent' };

  const resolved = await resolveWebSession(token);

  // R210: the reason (unknown, expired, revoked) stops here. The caller is
  // unauthenticated, so it learns only that the session is over.
  if (!resolved.ok) return { state: 'ended' };

  return { state: 'signed-in', userId: resolved.userId, sessionId: resolved.sessionId, token };
}
