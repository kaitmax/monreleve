// web/lib/alerts/purge.ts
//
// The thirty-day purge. FW14 increment 6, AC3.
//
// IT EXISTS BECAUSE A PAGE ALREADY SAYS IT DOES. /confidentialite has said
// since FW10 that "une inscription aux alertes qui reste non confirmée est
// supprimée au bout de 30 jours". That page is live. Until this file, the
// sentence described an intention - and a published privacy claim that
// nothing enforces is exactly the outcome FW14 may not produce.
//
// WHAT IT DELETES, STATED NARROWLY. Rows that were never confirmed and are
// older than thirty days. NOT confirmed rows, however old: the rule is about
// subscriptions lapsing, not about deleting subscribers, and a purge reading
// the date alone would empty the list every month. NOT unsubscribed rows
// either: those are kept on purpose, because they are what stops somebody
// being re-subscribed by accident.
//
// SCHEDULING IS FW27's. SPEC 3 names pg-boss for exactly this, started once in
// instrumentation.ts behind a globalThis guard. That task does not exist yet,
// so this ships as a function with a script that runs it - testable today,
// scheduled later. Saying so is the point: FW12 found pnpm test:runtime had
// not run since FW10, and "a guard that hasn't run since FW10 is a guard we
// don't have". A retention job nobody executes is that shape with a regulator
// on the other end.

import { prisma } from '@/lib/db/client';

/** The number /confidentialite states. Changing one without the other is a lie. */
export const PURGE_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Delete unconfirmed subscriptions past their thirty days.
 *
 * @returns how many rows went, so a scheduler can log something true.
 */
export async function purgeUnconfirmed(now: number = Date.now()): Promise<number> {
  const cutoff = new Date(now - PURGE_AFTER_DAYS * DAY_MS);

  const { count } = await prisma.alertSubscriber.deleteMany({
    where: {
      // Never confirmed...
      confirmedAt: null,
      // ...and never unsubscribed, because an unsubscribed row that was never
      // confirmed is still a record of somebody asking not to be written to.
      unsubscribedAt: null,
      createdAt: { lt: cutoff },
    },
  });

  return count;
}
