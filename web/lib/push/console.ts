// web/lib/push/console.ts
//
// The development sender: it prints the notification instead of sending it.
// FW27 increment 3.
//
// ============================================================================
// IT EXISTS BECAUSE THE MAILER'S EQUIVALENT DID NOT, FOR EIGHT TASKS
// ============================================================================
//
// lib/alerts/mailer.ts carried a comment from FW14 saying the outbox was there
// "for `pnpm dev`, where reading the confirmation link out of the terminal is
// how the loop gets exercised without a mail provider" - and nothing printed
// anything, so the loop it described could not be exercised. FW22's
// walkthrough needed the link and found the mechanism missing (R154).
//
// A push is worse in that respect than an email, because there is no outbox to
// read afterwards: unless something prints it, nobody on this machine will
// ever see what a reminder says. FW26 shipped enum tokens to a French reader
// in a document where every count was right, and the thing that caught it was
// somebody reading the output.
//
// DEVELOPMENT ONLY, AND lib/push/resolve.ts DECIDES. In production a missing
// credential means there is NO sender, not a sender that prints - see that
// file for why a push that silently succeeds is worse than one that refuses.

import type { PushAttempt, PushNotification, PushSender } from '@/lib/push/sender';

export class ConsolePushSender implements PushSender {
  async send(token: string, notification: PushNotification): Promise<PushAttempt> {
    console.log(
      [
        '',
        '--- push not sent (no FCM credentials); here it is --------------',
        // THE TOKEN IS TRUNCATED. It is a device credential, and a terminal
        // is a place things get pasted from. Eight characters is enough to
        // tell two devices apart while walking through a fan-out.
        `device:  ${token.slice(0, 8)}…`,
        `title:   ${notification.title}`,
        `body:    ${notification.body}`,
        `data:    ${JSON.stringify(notification.data)}`,
        '----------------------------------------------------------------',
        '',
      ].join('\n'),
    );

    return { outcome: 'delivered', status: 200 };
  }
}
