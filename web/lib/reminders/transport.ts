// web/lib/reminders/transport.ts
//
// How a reminder leaves this process. FW27 increment 2, extended by 3.
//
// ============================================================================
// THE SEAM EXISTS SO THAT TESTS CANNOT DELIVER (R243)
// ============================================================================
//
// This is the first code in the product that acts without being asked. A test
// that accidentally sends is not a failing test - it is a notification in
// somebody's hand, and there is no undo. So the job never reaches a network:
// it takes a transport, and the tests hand it one that records.
//
// It is the same boundary FW14 drew for the alert mailer, one product surface
// over, and for the same reason.

/** What a reminder says. The client renders it; this is the data. */
export interface ReminderMessage {
  readonly userId: string;
  /** The local day the reminder is about, `YYYY-MM-DD`. */
  readonly day: string;
  /**
   * Whether the person logs by hand or by detection.
   *
   * SPEC §13.3 says the notification "carries the proposal" in auto mode -
   * *« Journée détectée : Domicile. Confirmer ? »*. THE SERVER DOES NOT HAVE
   * THAT PROPOSAL: detection happens on the device, D16 writes nothing until
   * the person taps, and no table holds a pending one. So the payload carries
   * the MODE, and a client in auto mode shows the proposal it already has
   * locally. PARKED in REPORT-FW27.txt - storing proposals server-side would
   * be a new table and a new thing to erase.
   */
  readonly mode: 'MANUAL' | 'AUTO_DETECT';
}

/**
 * What one delivery established.
 *
 * ============================================================================
 * ZERO DEVICES IS ITS OWN OUTCOME, NEITHER A SEND NOR A FAILURE
 * ============================================================================
 *
 * FW27 increment 2 typed this `void`, and increment 3 found the gap when the
 * first real transport arrived. Somebody with reminders on and no registered
 * device is a REAL STATE: they turned reminders on, then uninstalled, and
 * their token was pruned on the next send.
 *
 *   reported as a FAILURE  the job releases the day and retries on every run,
 *                          for ever, and `failed` carries a number nothing
 *                          can act on
 *   reported as a SEND     the job records a reminder nobody received, which
 *                          is the one number R244 exists to make trustworthy
 *
 * So the transport says how many devices it actually reached, and the job
 * counts zero separately.
 */
export interface ReminderDelivery {
  readonly devices: number;
}

export interface ReminderTransport {
  /**
   * Deliver one reminder.
   *
   * Throwing means "not delivered, and retrying may help"; the job records it
   * as a failure and does NOT keep the sent-row, so the next run tries again.
   * A transport that swallowed its own errors would make a person stop
   * receiving reminders with nothing recording why.
   *
   * Returning zero devices means "there was nowhere to deliver", which no
   * amount of retrying changes.
   */
  send(message: ReminderMessage): Promise<ReminderDelivery>;
}

/**
 * The transport the job's own tests use.
 *
 * It records rather than sends, and it can be told to fail or to have nowhere
 * to deliver, because those are the two cases that decide whether a retry
 * double-sends and whether a claim is released.
 */
export class FakeTransport implements ReminderTransport {
  readonly sent: ReminderMessage[] = [];

  private failFor = new Set<string>();

  private withoutDevice = new Set<string>();

  /** Make the next send for this user throw, once. */
  failOnce(userId: string): void {
    this.failFor.add(userId);
  }

  /** Make this user have no device, from now on. */
  noDevicesFor(userId: string): void {
    this.withoutDevice.add(userId);
  }

  async send(message: ReminderMessage): Promise<ReminderDelivery> {
    if (this.failFor.has(message.userId)) {
      this.failFor.delete(message.userId);

      throw new Error(`fake transport: refusing to deliver to ${message.userId}`);
    }

    // NOT RECORDED IN `sent`. That array is what a person received.
    if (this.withoutDevice.has(message.userId)) return { devices: 0 };

    this.sent.push(message);

    return { devices: 1 };
  }
}
