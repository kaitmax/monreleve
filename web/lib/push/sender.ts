// web/lib/push/sender.ts
//
// The seam between "a reminder exists" and "a push left this process".
// FW27 increment 3.
//
// ============================================================================
// ONE FUNCTION CAN PUT A PUSH ON THE WIRE, AND IT IS NOT THIS FILE
// ============================================================================
//
// The same boundary FW14 drew for mail, one product surface over: everything
// above talks to a `PushSender`, and only lib/push/fcm.ts knows Firebase
// exists. It matters less for tidiness than for the guarantee underneath it -
// "no test can deliver to a real person" (R243) is a property of one module
// rather than a habit spread across call sites.
//
// ============================================================================
// THE CLASSIFICATION IS THE WHOLE SAFETY ARGUMENT
// ============================================================================
//
// Pruning a token is DESTRUCTIVE and SILENT. Delete the wrong row and somebody
// simply stops receiving reminders; nothing is logged on their device, nothing
// surfaces in the application, and the first anybody hears of it is a person
// saying the reminders stopped months ago. There is no undo, because the token
// only comes back when the client re-registers.
//
// So the rule is stated as a WHITELIST, never as a blacklist of things not to
// prune on. Exactly two statuses mean the token is gone; every other answer -
// including a refusal that looks permanent, like 401 or 403 - leaves the row
// alone. A credential outage answering 401 for every token would otherwise
// delete every device this product has in a single run, which is the shape of
// failure that is unrecoverable rather than merely bad.

/** What a push says. `data` is string-valued because FCM's payload is. */
export interface PushNotification {
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>>;
}

/**
 * What one attempt established, said in terms of the TOKEN rather than of the
 * request - because the only decision downstream is whether to keep the row.
 *
 *   delivered    the service accepted it.
 *   token_dead   the service says this token no longer exists. Prune.
 *   undelivered  anything else. Keep the row and try again next time.
 */
export type PushOutcome = 'delivered' | 'token_dead' | 'undelivered';

export interface PushAttempt {
  readonly outcome: PushOutcome;
  /** The status the service answered, or null when none was reached. */
  readonly status: number | null;
}

export interface PushSender {
  send(token: string, notification: PushNotification): Promise<PushAttempt>;
}

/**
 * The only two statuses that mean the token is gone.
 *
 * FCM HTTP v1 answers 404 with `UNREGISTERED` for a token whose application
 * was uninstalled or whose registration was replaced. 410 is the equivalent
 * from the legacy endpoint and from every other push service this could ever
 * be pointed at; it is here so that the rule reads as a rule about push
 * registration rather than a fact about one vendor's current API.
 */
export const DEAD_TOKEN_STATUSES: readonly number[] = [404, 410];

/**
 * A status, read as a fact about the token.
 *
 * THE DEFAULT IS TO KEEP THE ROW. A status nobody anticipated - a proxy's 502,
 * a quota 429, a future 451 - lands on `undelivered`, which costs one missed
 * reminder. The opposite default costs a person their reminders permanently
 * and tells nobody.
 */
export function classifyPushStatus(status: number): PushOutcome {
  if (status >= 200 && status < 300) return 'delivered';
  if (DEAD_TOKEN_STATUSES.includes(status)) return 'token_dead';

  return 'undelivered';
}
