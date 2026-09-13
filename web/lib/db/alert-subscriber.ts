// web/lib/db/alert-subscriber.ts
//
// The small amount of domain logic that has to be identical everywhere an
// address is handled. FW14.
//
// NOT A REPOSITORY LAYER. FW14's standing protocol is explicit - "no ORM
// abstraction layer over Prisma" - and this is not one: route handlers talk to
// `prisma.alertSubscriber` directly. What lives here is the one rule that
// cannot be re-decided per call site without breaking the table's meaning.

/**
 * The address as it is stored, and as the unique index sees it.
 *
 * TRIMMED because a trailing space is a typing artefact, never an intention,
 * and it would make " a@b.com" a different person from "a@b.com".
 *
 * LOWERCASED, which is the part with a trade in it. RFC 5321 makes the local
 * part case-sensitive: Jean.Dupont@example.com and jean.dupont@example.com are
 * formally two mailboxes. No mail provider anyone will plausibly use treats
 * them as two people, and treating them as two here would mean two rows, two
 * recorded consents for one act of consent, and an unsubscribe that only half
 * works - the reader clicks it and the other row keeps them on the list. The
 * cost lands on a hypothetical case-sensitive provider; the benefit lands on
 * every real reader. tests/db/alert-subscriber.test.ts states the trade.
 *
 * NO VALIDATION HERE. Whether a string is a plausible address is the
 * subscribe handler's question (increment 2, zod), asked before this is
 * called. Normalising and validating in one function would mean every caller
 * had to handle a rejection from something that reads like a formatter.
 */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
