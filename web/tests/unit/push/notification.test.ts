// web/tests/unit/push/notification.test.ts
//
// The sentence a person reads on a lock screen. FW27 increment 3.
//
// ============================================================================
// THE THREE THINGS A NOTIFICATION HAS TO DO, ASSERTED AS THREE THINGS
// ============================================================================
//
// SPEC §13.3 makes the cost of getting this wrong specific: "a compliance tool
// that nags gets uninstalled". So the test is not "a string is produced" -
// that is true of « Ouvrez l'application », which is the version that spends
// somebody's attention to tell them nothing.
//
//   it names the day        a title true every day of the year is not a
//                           reminder, it is a notification badge
//   it says what it wants   the manual body names the four answers; the auto
//                           body names the one decision
//   it is in French         FW26 shipped enum tokens to a French reader in a
//                           document where every count was right
//
// R206: the rendered day comes from the product's one date formatter, so this
// asserts the formatter's output rather than a second spelling of it.

import { describe, expect, it } from 'vitest';
import { REMINDER_PUSH_KIND, reminderNotification } from '@/lib/push/message';
import { formatDate } from '@/lib/ui/core/format/date';

const DAY = '2026-07-07';
const RENDERED = formatDate(DAY);

/** Every machine token that has any business being near this copy. */
const ENUM_TOKENS = ['MANUAL', 'AUTO_DETECT', 'HOME', 'CH', 'MISSION', 'ABSENT', 'FULL', 'HALF'];

describe('a reminder names the day it is about', () => {
  it('puts the rendered day in the title, in both modes', () => {
    expect(RENDERED).toBe('07.07.2026');

    for (const mode of ['MANUAL', 'AUTO_DETECT'] as const) {
      const notification = reminderNotification({ userId: 'u', day: DAY, mode });

      expect(notification.title, `${mode} title`).toContain(RENDERED);
    }
  });

  it('carries the ISO day and the mode in the data, for the client to act on', () => {
    expect(reminderNotification({ userId: 'u', day: DAY, mode: 'AUTO_DETECT' }).data).toEqual({
      kind: REMINDER_PUSH_KIND,
      day: DAY,
      mode: 'AUTO_DETECT',
    });
  });
});

describe('a reminder says what it wants', () => {
  it('names the four answers in manual mode, which is the whole decision', () => {
    const { body } = reminderNotification({ userId: 'u', day: DAY, mode: 'MANUAL' });

    for (const answer of ['domicile', 'Suisse', 'mission', 'absence']) {
      expect(body, `the manual body should name ${answer}`).toContain(answer);
    }
  });

  it('names the decision in auto mode - confirm or correct', () => {
    const { body } = reminderNotification({ userId: 'u', day: DAY, mode: 'AUTO_DETECT' });

    expect(body).toContain('confirmer');
    expect(body).toContain('corriger');
  });

  it('says something DIFFERENT in the two modes', () => {
    // Without this, a copy module that returned the manual text for both would
    // pass every assertion above - and an auto-mode reader would be asked to
    // enter a day their device has already proposed.
    const manual = reminderNotification({ userId: 'u', day: DAY, mode: 'MANUAL' });
    const auto = reminderNotification({ userId: 'u', day: DAY, mode: 'AUTO_DETECT' });

    expect(manual.title).not.toBe(auto.title);
    expect(manual.body).not.toBe(auto.body);
  });
});

describe('a reminder is French, all the way down', () => {
  it('leaks no enum token into anything a person reads', () => {
    // FW26's defect, stated as a guard. Every count in that export was right.
    for (const mode of ['MANUAL', 'AUTO_DETECT'] as const) {
      const { title, body } = reminderNotification({ userId: 'u', day: DAY, mode });

      for (const token of ENUM_TOKENS) {
        expect(`${title} ${body}`, `${mode} should not show ${token}`).not.toContain(token);
      }
    }
  });

  it('carries no identifier a person did not ask to see', () => {
    // The user id is how the job addresses the message; it is not something a
    // notification has any reason to display.
    const { title, body } = reminderNotification({
      userId: 'cuid-of-a-real-person',
      day: DAY,
      mode: 'MANUAL',
    });

    expect(`${title} ${body}`).not.toContain('cuid-of-a-real-person');
  });
});
