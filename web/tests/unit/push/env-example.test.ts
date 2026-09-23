// web/tests/unit/push/env-example.test.ts
//
// The placeholders a deployment might copy are the placeholders the code
// refuses. FW27 increment 3.
//
// ============================================================================
// R181: THE TEXT IS DERIVED FROM THE THING IT DESCRIBES, NEVER TRANSCRIBED
// ============================================================================
//
// `PLACEHOLDER_SECRET` has carried the comment *"The value `.env.example`
// ships"* since FW25, and nothing checked that it still did. That is a
// transcription: correct on the day it was written and silently wrong
// afterwards, with every suite green - because the guard and the file it
// describes have no connection.
//
// THE FAILURE IT ALLOWS IS SPECIFIC AND SILENT. Change the example without
// changing the constant and the refusal stops firing: a deployment that copied
// `.env.example` is then running with a signing key everybody has, or
// addressing a Firebase project that does not exist, and the code that exists
// to catch exactly that reports nothing, because the string it compares
// against is no longer the string anybody has.
//
// So the example is READ and the constants are asserted to appear in it.
// Covering AUTH_SECRET as well as the three FCM values: it is the same file,
// the same class, and the hole was already open there.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_SECRET } from '@/lib/export/print-token';
import {
  PLACEHOLDER_CLIENT_EMAIL,
  PLACEHOLDER_PRIVATE_KEY,
  PLACEHOLDER_PROJECT_ID,
} from '@/lib/push/fcm';

const EXAMPLE = readFileSync(join(process.cwd(), '.env.example'), 'utf8');

describe('.env.example ships exactly the values the code refuses', () => {
  it('was read, so nothing below passes vacuously (R169)', () => {
    expect(EXAMPLE.length).toBeGreaterThan(200);
    expect(EXAMPLE).toContain('DATABASE_URL=');
  });

  it('assigns each placeholder to its own variable, as the value', () => {
    // `toContain` on the value alone would pass on a file that merely
    // mentioned it in a comment, which is the assertion passing for the wrong
    // reason - so each is matched as a complete assignment line.
    const lines = EXAMPLE.split(/\r?\n/u);

    for (const [name, value] of [
      ['AUTH_SECRET', PLACEHOLDER_SECRET],
      ['FCM_PROJECT_ID', PLACEHOLDER_PROJECT_ID],
      ['FCM_CLIENT_EMAIL', PLACEHOLDER_CLIENT_EMAIL],
      ['FCM_PRIVATE_KEY', PLACEHOLDER_PRIVATE_KEY],
    ] as const) {
      expect(lines, `${name} must ship the value the code refuses`).toContain(
        `${name}=${value}`,
      );
    }
  });

  it('would catch a drifted example, which is the whole point', () => {
    // The detector fires on what it is for (R133). A file that no longer
    // ships the refused value fails this, in the same shape the real
    // assertion above uses.
    const drifted = EXAMPLE.replace(PLACEHOLDER_PROJECT_ID, 'some-other-project').split(/\r?\n/u);

    expect(drifted).not.toContain(`FCM_PROJECT_ID=${PLACEHOLDER_PROJECT_ID}`);
  });
});
