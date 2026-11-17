// web/lib/alerts/email.ts
//
// What counts as an address, for every form that takes one. FW-DELAI-RAPPEL
// (R915) EXTRACTED it from subscribe.ts, where it was private: the reminder
// form asks the same question, and a second regular expression would be a
// second answer to it. subscribe.ts reads it from here; its tests are
// untouched.

/**
 * RFC 5321 caps a forward path at 256 octets. Past that an address is not a
 * typo - it is either a mistake of a different kind or a deliberate one, and
 * an unbounded string ends up in the database and on screen.
 */
export const MAX_EMAIL = 254;

/**
 * WHY NOT z.email(). Zod's built-in is a reasonable general-purpose check and
 * its exact grammar is a moving target between versions; what this needs is a
 * rule the French error message can honestly describe. The message says "un
 * @ et un nom de domaine", so that is what is checked: one at-sign, something
 * either side, no whitespace, and a dot in the domain.
 *
 * DELIBERATELY NOT RFC-COMPLETE. A full 5322 grammar accepts quoted strings
 * and comments that no signup form has ever legitimately received, and every
 * address it would additionally accept is one we cannot deliver to anyway.
 * The failure direction that matters is the other one - refusing a real
 * address - and this refuses none that a mail provider would issue.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/** Whether an already-normalised address is one the forms accept. */
export function isPlausibleEmail(value: string): boolean {
  return value.length <= MAX_EMAIL && EMAIL.test(value);
}
