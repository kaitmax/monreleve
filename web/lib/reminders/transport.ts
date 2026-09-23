// web/lib/reminders/transport.ts
//
// How a reminder leaves this process. FW27 increment 2.
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

export interface ReminderTransport {
  /**
   * Deliver one reminder.
   *
   * Throwing means "not delivered"; the job records it as a failure and does
   * NOT write the sent-row, so the next run tries again. A transport that
   * swallowed its own errors would make a person stop receiving reminders
   * with nothing recording why.
   */
  send(message: ReminderMessage): Promise<void>;
}

/**
 * The transport the tests use, and the only one that exists until increment 3.
 *
 * It records rather than sends, and it can be told to fail, because "what
 * happens when delivery fails" is the case that decides whether a retry
 * double-sends.
 */
export class FakeTransport implements ReminderTransport {
  readonly sent: ReminderMessage[] = [];

  private failFor = new Set<string>();

  /** Make the next send for this user throw, once. */
  failOnce(userId: string): void {
    this.failFor.add(userId);
  }

  async send(message: ReminderMessage): Promise<void> {
    if (this.failFor.has(message.userId)) {
      this.failFor.delete(message.userId);

      throw new Error(`fake transport: refusing to deliver to ${message.userId}`);
    }

    this.sent.push(message);
  }
}
