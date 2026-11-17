// web/lib/alerts/subscribe.ts
//
// What a subscribe POST has to contain. FW14 increment 2.
//
// THE FORM IS A PLAIN HTML POST (R136): no island, no fetch, no client
// validation. Every field arrives as a string or not at all, from a browser
// that may have scripting disabled - which means this file is the only
// validation there is, not a second line behind a first.
//
// TOTAL, LIKE THE URL CODEC. parseSubscription never throws. A handler that
// can throw on input is a handler that answers a hostile POST with a stack
// trace, and the reader who typed a null byte gets a 500 instead of a
// sentence.

import { z } from 'zod';
import { ALERTES_COPY } from '@/lib/fr/alertes';
import { normaliseEmail } from '@/lib/db/alert-subscriber';
import { isPlausibleEmail } from '@/lib/alerts/email';

/**
 * Where a subscription came from.
 *
 * SPEC section 8 lists four and includes 'comparateur'. The comparator has a
 * page since FW-COMPARATEUR but no capture card yet (PARK-32), so accepting it
 * here would still be a branch nothing can reach. The database column is a String, so the fourth costs no migration on
 * the day that page ships.
 */
export const SOURCES = ['calculateur', 'alertes', 'guide'] as const;

export type Source = (typeof SOURCES)[number];

export interface Subscription {
  readonly email: string;
  readonly source: Source;
}

export type ParseResult =
  | { readonly ok: true; readonly value: Subscription }
  | { readonly ok: false; readonly error: string };

/**
 * WHAT COUNTS AS AN ADDRESS lives in lib/alerts/email.ts since FW-DELAI-RAPPEL
 * (R915): the reminder form asks the same question, and a second regular
 * expression would be a second answer to it. The reasoning moved with it.
 */

const schema = z.object({
  email: z
    .string()
    .transform(normaliseEmail)
    .refine((value) => value.length > 0, { error: ALERTES_COPY.errors.emailMissing })
    .refine((value) => isPlausibleEmail(value), {
      error: ALERTES_COPY.errors.emailInvalid,
    }),
  source: z.enum(SOURCES, { error: ALERTES_COPY.errors.sourceInvalid }),
});

/**
 * Read the form, or say why not.
 *
 * The first error wins, and the order is the reader's: an address problem is
 * theirs to fix and a source problem is ours, so theirs is reported first
 * when a broken form manages to produce both.
 */
export function parseSubscription(data: FormData): ParseResult {
  const raw = {
    email: typeof data.get('email') === 'string' ? String(data.get('email')) : '',
    source: data.get('source'),
  };

  const parsed = schema.safeParse(raw);

  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  const issues = parsed.error.issues;
  const emailIssue = issues.find((issue) => issue.path[0] === 'email');
  const first = emailIssue ?? issues[0];

  return {
    ok: false,
    // A zod issue always carries a message; the fallback exists because the
    // type says it can be undefined and a silent "" would be a blank notice.
    error: first?.message ?? ALERTES_COPY.errors.unavailable,
  };
}
