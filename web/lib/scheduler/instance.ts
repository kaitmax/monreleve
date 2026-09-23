// web/lib/scheduler/instance.ts
//
// ============================================================================
// WHICH CONTAINER IS SCHEDULING IS ANSWERABLE, NOT INFERRED (R244)
// ============================================================================
//
// `globalThis` is per-PROCESS, so a second container is a second scheduler by
// construction. FW28 measured what that actually costs, and the answer is
// nothing - but only because the arbitration lives somewhere `globalThis`
// cannot reach.
//
// THE CLAIM IS A UNIQUE ROW, NOT A LOCK. lib/reminders/job.ts creates a
// ReminderSent row keyed (userId, sentOn), and that insert IS the claim: the
// second container to try the same day loses on the unique constraint and
// reports `already-sent` by name. One notification, whatever the replica
// count.
//
// WHY THAT IS BETTER THAN THE OBVIOUS ALTERNATIVE. A pg_advisory_lock held on
// the session would elect one scheduler - and a container that dies without
// releasing keeps the lock until its connection is reaped, so the survivor
// silently never schedules. That failure is INDISTINGUISHABLE FROM WORKING,
// because the dead container had been doing the job. A unique row has no such
// state: a dead container releases nothing because it holds nothing, and the
// next run simply claims the day.
//
// WHAT WAS MISSING WAS THE NAME. With every replica scheduling and the
// database deciding per day, "which container sent it" was answerable only by
// correlating timestamps across logs. This makes each line say so.

import { hostname } from 'node:os';

/**
 * A short, stable identifier for this process.
 *
 * `hostname()` inside a container is the container id, which is what an
 * operator reads in `docker ps`; the pid disambiguates two processes in one
 * container, which should not happen and is exactly the thing worth seeing if
 * it does.
 *
 * NOT A UUID. A fresh random id per boot would be unique and useless: the
 * point is to name something an operator can already see somewhere else.
 */
export const SCHEDULER_INSTANCE = `${hostname()}/${process.pid}`;

/**
 * Prefix a scheduler log line with the instance that produced it.
 *
 * R198's shape: a refusal is labelled by the rule that raised it, and a run is
 * labelled by the process that ran it. Two containers logging identical lines
 * into one aggregator is the case this exists for.
 */
export function tagged(line: string): string {
  return line.replace('[scheduler]', `[scheduler ${SCHEDULER_INSTANCE}]`);
}
