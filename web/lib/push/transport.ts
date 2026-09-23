// web/lib/push/transport.ts
//
// A reminder, turned into one push per registered device. FW27 increment 3.
//
// ============================================================================
// THE JOB KNOWS NOTHING ABOUT DEVICES, AND THIS IS WHY
// ============================================================================
//
// lib/reminders/job.ts decides WHO is due; this decides WHERE that goes. The
// split is what lets the job's four cases be tested against a transport that
// records, and it is what keeps the destructive part - deleting a device row -
// in one file with one rule.
//
// ============================================================================
// "NOWHERE TO DELIVER" IS NOT A FAILURE, AND THE DIFFERENCE IS OPERATIONAL
// ============================================================================
//
// Somebody with reminders on and no registered device is a real state: they
// turned reminders on, then uninstalled, and their token was pruned on the
// first send afterwards. Reporting that as a DELIVERY FAILURE would make the
// job release the day and try again on every run, for ever, and would inflate
// `failed` with a number nothing can act on.
//
// Reporting it as a SEND would be worse - the job would record a reminder
// nobody received, which is the one number R244 exists to make trustworthy.
//
// So the transport returns how many devices it actually reached, and zero is
// its own outcome. The job counts it separately and releases the claim, so
// that registering a device later the same day still earns today's reminder.
//
// ============================================================================
// PRUNING HAPPENS HERE AND ONLY ON THE WHITELIST
// ============================================================================
//
// See lib/push/sender.ts for why the rule is a whitelist. The consequence
// here: a run where every device answers 503 deletes nothing and throws, so
// the job retries; a run where every device answers 404 deletes everything and
// does not throw, because retrying a token the service says is gone is how a
// job spins for ever on a person who is no longer there.

import { prisma } from '@/lib/db/client';
import { reminderNotification } from '@/lib/push/message';
import type { PushSender } from '@/lib/push/sender';
import type {
  ReminderDelivery,
  ReminderMessage,
  ReminderTransport,
} from '@/lib/reminders/transport';

export class DevicePushTransport implements ReminderTransport {
  constructor(private readonly sender: PushSender) {}

  async send(message: ReminderMessage): Promise<ReminderDelivery> {
    const devices = await prisma.device.findMany({
      where: { userId: message.userId },
      select: { id: true, fcmToken: true },
    });

    if (devices.length === 0) return { devices: 0 };

    const notification = reminderNotification(message);

    let delivered = 0;
    let pruned = 0;
    let undelivered = 0;

    for (const device of devices) {
      const attempt = await this.sender.send(device.fcmToken, notification);

      if (attempt.outcome === 'delivered') {
        delivered += 1;
        continue;
      }

      if (attempt.outcome === 'token_dead') {
        await prisma.device.delete({ where: { id: device.id } });
        pruned += 1;
        continue;
      }

      undelivered += 1;
    }

    // R244 one layer down: the counts that decide whether somebody stopped
    // receiving reminders are the ones nobody is watching. The token itself is
    // never logged - it is a device identifier, and /confidentialite says what
    // is kept rather than what is printed.
    if (pruned > 0 || undelivered > 0) {
      console.log(
        `[push] ${message.day}: ${devices.length} device(s), delivered ${delivered}, ` +
          `pruned ${pruned} dead, ${undelivered} undelivered`,
      );
    }

    // NOTHING GOT THROUGH AND THE REASON WAS NOT THE TOKENS. That is a
    // delivery failure: the job releases the day and the next run retries.
    // Had every token been dead instead, `undelivered` is zero, the rows are
    // gone, and there is nothing to retry - which returns zero devices below.
    if (delivered === 0 && undelivered > 0) {
      throw new Error(`[push] no device accepted the reminder for ${message.day}`);
    }

    return { devices: delivered };
  }
}
