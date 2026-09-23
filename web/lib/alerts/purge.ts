// web/lib/alerts/purge.ts
//
// The thirty-day purge. FW14 increment 6, AC3; counted by FW27 increment 4.
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
// ============================================================================
// R244: IT REPORTS WHAT IT DID, NOT THAT IT RAN
// ============================================================================
//
// FW14 returned a count of deletions, which is the number a scheduler can log
// and the number that cannot be read. Zero deleted is true of a healthy list
// with nothing lapsed, and equally true of a query whose `confirmedAt: null`
// became `confirmedAt: undefined` in a refactor and now matches everything or
// nothing. Nobody is watching when this runs, so the run says what it
// CONSIDERED as well as what it removed, and why it kept the rest.
//
// THE THREE KEPT-COUNTS ARE THE TWO EXEMPTIONS AND THE AGE RULE, each the
// reason a row survived. A sum that stops adding up - considered ≠ deleted +
// kept - means the query and the census disagree, which is the failure a
// single number cannot show.

import { prisma } from '@/lib/db/client';

/** The number /confidentialite states. Changing one without the other is a lie. */
export const PURGE_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What one run did. */
export interface PurgeRun {
  /** The moment a row had to be older than, ISO. */
  readonly cutoff: string;
  /** Every unconfirmed row, whatever its age or state. */
  readonly considered: number;
  readonly deleted: number;
  /** Unconfirmed, past the cutoff, kept because it asked not to be written to. */
  readonly keptUnsubscribed: number;
  /** Unconfirmed, still inside its thirty days. */
  readonly keptTooRecent: number;
}

/**
 * Delete unconfirmed subscriptions past their thirty days.
 *
 * `now` is a parameter so the boundary can be tested at 29 and 31 days without
 * waiting a month (R171: the role is "the moment this run represents").
 */
export async function purgeUnconfirmed(now: number = Date.now()): Promise<PurgeRun> {
  const cutoff = new Date(now - PURGE_AFTER_DAYS * DAY_MS);

  // COUNTED BEFORE THE DELETE, because after it the rows are gone and the
  // census would be of what survived rather than of what was examined.
  const [considered, keptUnsubscribed, keptTooRecent] = await Promise.all([
    prisma.alertSubscriber.count({ where: { confirmedAt: null } }),
    prisma.alertSubscriber.count({
      where: { confirmedAt: null, unsubscribedAt: { not: null }, createdAt: { lt: cutoff } },
    }),
    prisma.alertSubscriber.count({
      where: { confirmedAt: null, createdAt: { gte: cutoff } },
    }),
  ]);

  const { count: deleted } = await prisma.alertSubscriber.deleteMany({
    where: {
      // Never confirmed...
      confirmedAt: null,
      // ...and never unsubscribed, because an unsubscribed row that was never
      // confirmed is still a record of somebody asking not to be written to.
      unsubscribedAt: null,
      createdAt: { lt: cutoff },
    },
  });

  return {
    cutoff: cutoff.toISOString(),
    considered,
    deleted,
    keptUnsubscribed,
    keptTooRecent,
  };
}

/** One line for a log, since nobody is watching when this runs. */
export function describePurge(run: PurgeRun): string {
  return (
    `[purge] older than ${PURGE_AFTER_DAYS} days (${run.cutoff}): ` +
    `considered ${run.considered} unconfirmed, deleted ${run.deleted}, ` +
    `kept ${run.keptUnsubscribed} unsubscribed and ${run.keptTooRecent} too recent`
  );
}
