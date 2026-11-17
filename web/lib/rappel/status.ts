// web/lib/rappel/status.ts
//
// FW-DELAI-RAPPEL: what the sign-up endpoint answers, as values both the
// island and the route handler read. No copy here: the sentence for each
// status is the server's (lib/fr/rappel.ts), sent in the answer, so the
// comparator's island carries the codes and not the French (Queue Ruling 23:
// the comparator's first-load JS is a budget, and these sentences are read
// once, after a submit).

/** Where the island posts the address and the computed date. */
export const REMINDER_ENDPOINT = '/api/rappel-delai';

export const REMINDER_STATUS = {
  /** Accepted. The same answer for a new address and one already known (R915). */
  ok: 'ok',
  /** The field was empty. */
  missing: 'adresse-manquante',
  /** Something arrived and it was not an address. */
  invalid: 'adresse-invalide',
  /** Not a real day, or fewer than fourteen days away (R916). */
  date: 'date-refusee',
  /** Too many attempts from this connection. */
  rate: 'trop-de-tentatives',
  /** The database or the mailer refused. */
  unavailable: 'indisponible',
} as const;

export type ReminderStatus = (typeof REMINDER_STATUS)[keyof typeof REMINDER_STATUS];

/** The two statuses that belong to the address field rather than the form. */
export function isFieldStatus(status: string): boolean {
  return status === REMINDER_STATUS.missing || status === REMINDER_STATUS.invalid;
}
