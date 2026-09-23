// web/lib/push/fake.ts
//
// The sender every test uses, and the one `pnpm dev` uses. FW27 increment 3.
//
// ============================================================================
// IT IS NOT A MOCK NOBODY HAS TO REMEMBER TO INSTALL (R243)
// ============================================================================
//
// FW14's mail boundary switches on the ABSENCE OF A KEY rather than on a test
// flag, because a flag can be true in production and a missing key cannot. The
// same argument holds here and is stronger: there is no Firebase project, so
// `createFcmSender` answers `not_configured` on every machine that exists
// today, and this is what gets used.
//
// So a test cannot deliver by forgetting something. It would have to set three
// environment variables to values nobody has.
//
// AND IT IS SCRIPTABLE, because the interesting cases are the failures. Which
// status came back decides whether a device row survives, and that decision is
// destructive and silent - it needs a sender that can answer 404, 410 and 503
// on demand.

import { classifyPushStatus } from '@/lib/push/sender';
import type { PushAttempt, PushNotification, PushSender } from '@/lib/push/sender';

export interface FakePush {
  readonly token: string;
  readonly notification: PushNotification;
}

export class FakePushSender implements PushSender {
  /** Everything that was handed to this sender, delivered or not. */
  readonly attempted: FakePush[] = [];

  /** Only what the service accepted - what a person would actually see. */
  readonly delivered: FakePush[] = [];

  private statuses = new Map<string, number>();

  /**
   * Make this token answer with this status from now on.
   *
   * PERSISTENT RATHER THAN ONCE, unlike FakeTransport.failOnce: a dead token
   * is dead every time, and a test proving a retry does not resurrect it needs
   * the second attempt to answer the same way.
   */
  answerWith(token: string, status: number): void {
    this.statuses.set(token, status);
  }

  async send(token: string, notification: PushNotification): Promise<PushAttempt> {
    this.attempted.push({ token, notification });

    const status = this.statuses.get(token) ?? 200;
    const outcome = classifyPushStatus(status);

    if (outcome === 'delivered') this.delivered.push({ token, notification });

    return { outcome, status };
  }
}
