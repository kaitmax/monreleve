// web/tests/unit/push/resolve.test.ts
//
// Which sender a process gets, and the case where it gets none.
// FW27 increment 3.
//
// ============================================================================
// THE PRODUCTION REFUSAL IS THE ASSERTION THAT MATTERS
// ============================================================================
//
// A sender that silently accepted everything would make the reminder job's
// `sent` count a number of pushes nobody received - healthy-looking precisely
// when the product is broken. R243 adds the other half: with no credentials
// anywhere, a path that quietly fell back to something that "works" is the
// path by which a test reaches a person.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PLACEHOLDER_PROJECT_ID,
  PLACEHOLDER_PRIVATE_KEY,
  PLACEHOLDER_CLIENT_EMAIL,
} from '@/lib/push/fcm';
import { ConsolePushSender } from '@/lib/push/console';
import { describePushSender, resolvePushSender } from '@/lib/push/resolve';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('with no credentials', () => {
  it('refuses in production, by name', () => {
    // NODE_ENV omitted deliberately: anything that is not development is the
    // refusing branch, which is where a misconfigured deployment lands.
    expect(resolvePushSender({})).toEqual({ ok: false, code: 'not_configured' });
  });

  it('refuses under a test environment, which is where this suite runs', () => {
    // R243 stated as a test. If this ever returns a sender, something in a
    // test run can address a device.
    expect(resolvePushSender({ NODE_ENV: 'test' }).ok).toBe(false);
  });

  it('gives development the printing sender instead, so a walkthrough can read one', () => {
    const resolved = resolvePushSender({ NODE_ENV: 'development' });

    expect(resolved.ok).toBe(true);

    if (!resolved.ok) throw new Error('unreachable');

    expect(resolved.kind).toBe('console');
    expect(resolved.sender).toBeInstanceOf(ConsolePushSender);
  });
});

describe('with placeholder credentials', () => {
  const placeholders = {
    FCM_PROJECT_ID: PLACEHOLDER_PROJECT_ID,
    FCM_CLIENT_EMAIL: PLACEHOLDER_CLIENT_EMAIL,
    FCM_PRIVATE_KEY: PLACEHOLDER_PRIVATE_KEY,
  };

  it('refuses in production, and says which rule fired', () => {
    // NOT "not_configured". A deployment that pasted the example needs to be
    // told that is what happened, or somebody searches for a variable that is
    // already set.
    expect(resolvePushSender(placeholders)).toEqual({
      ok: false,
      code: 'placeholder_credentials',
    });
  });
});

describe('describePushSender names what happened', () => {
  it('distinguishes the two refusals, because they send somebody different places', () => {
    const missing = describePushSender({ ok: false, code: 'not_configured' });
    const example = describePushSender({ ok: false, code: 'placeholder_credentials' });

    expect(missing).toContain('not_configured');
    expect(example).toContain('placeholder_credentials');
    expect(missing).not.toBe(example);
  });

  it('says plainly that development delivers to nobody', () => {
    const resolved = resolvePushSender({ NODE_ENV: 'development' });

    expect(describePushSender(resolved)).toContain('nobody');
  });
});

describe('the console sender prints what it did not send (R154)', () => {
  it('puts the title, the body and the data in the terminal', async () => {
    // NOT "it did not throw". FW14's outbox carried a comment saying it
    // printed for `pnpm dev` and printed nothing for eight tasks.
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const attempt = await new ConsolePushSender().send('token-abcdefghijklmnop', {
      title: 'Journée du 07.07.2026 à enregistrer',
      body: 'Indiquez où vous avez travaillé.',
      data: { kind: 'daily_reminder', day: '2026-07-07' },
    });

    expect(attempt).toEqual({ outcome: 'delivered', status: 200 });

    const printed = log.mock.calls.map((call) => String(call[0])).join('\n');

    expect(printed).toContain('Journée du 07.07.2026 à enregistrer');
    expect(printed).toContain('Indiquez où vous avez travaillé.');
    expect(printed).toContain('daily_reminder');
  });

  it('truncates the device token rather than printing a credential', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await new ConsolePushSender().send('token-abcdefghijklmnop', {
      title: 'x',
      body: 'y',
      data: {},
    });

    const printed = log.mock.calls.map((call) => String(call[0])).join('\n');

    expect(printed).toContain('token-ab');
    expect(printed).not.toContain('token-abcdefghijklmnop');
  });
});
