// web/tests/unit/push/malformed-key.test.ts
//
// ============================================================================
// R861: A KEY REFUSAL THAT SAYS WHICH RULE FAILED, NEVER THE VALUE
// ============================================================================
//
// Production's startup log said "[push] no push sender
// (malformed_private_key)" (REPORT-FW-CHROMIUM.txt section 4, plan e), and
// nothing more. readFcmCredentials already restores escaped newlines, so the
// stored value failed the PEM test for some other reason - and the refusal
// could not say which. The next paste (operator item A5) must not be able to
// fail silently a second time, so the refusal now names the SHAPE that failed.
//
// EACH SHAPE IS A WAY A REAL PASTE GOES WRONG, built from a real key generated
// in this file, never from a stand-in string: a stand-in would prove the
// classifier reads a string, not that it reads what a deployment surface
// actually delivers.
//
// THE LOG LINE CARRIES NO KEY MATERIAL, and that half is asserted through the
// very expression instrumentation.ts logs at startup -
// describePushSender(resolvePushSender()) - with the environment passed in
// rather than set on the process (R171). Two assertions, because each alone
// is satisfiable by the wrong thing: "no body line appears" holds for a line
// that leaks a fragment shorter than a line, and "the line is the same for two
// different keys" proves nothing key-derived is in it at all.

import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readFcmCredentials } from '@/lib/push/fcm';
import type { EnvLike, MalformedKeyShape } from '@/lib/push/fcm';
import { describePushSender, resolvePushSender } from '@/lib/push/resolve';

function generateKey(): string {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;
}

const KEY = generateKey();
const OTHER_KEY = generateKey();

/** How a deployment surface carries a key: one line, newlines escaped. */
function escaped(pem: string): string {
  return pem.replaceAll('\n', String.raw`\n`);
}

/**
 * Every refused shape, with the paste that produces it.
 *
 * ORDER IS PART OF THE CONTRACT. A key can be wrong in more than one way at
 * once - quoted AND escaped twice - and the detail names the outermost cause,
 * the one the operator meets first when looking at the value.
 */
const SHAPES: ReadonlyArray<
  readonly [shape: MalformedKeyShape, how: string, paste: (pem: string) => string]
> = [
  [
    'quoted',
    "pasted with the JSON string's own quotation marks",
    (pem) => `"${escaped(pem)}"`,
  ],
  [
    'backslash_after_restore',
    'escaped twice, as a JSON string encoded a second time (\\\\n for each newline)',
    (pem) => pem.replaceAll('\n', String.raw`\\n`),
  ],
  [
    'no_pem_header',
    'the first line lost in the paste, so the body starts the value',
    (pem) => escaped(pem.split('\n').slice(1).join('\n')),
  ],
  [
    'text_before_pem_header',
    'the whole .env line pasted as the value',
    (pem) => `FCM_PRIVATE_KEY=${escaped(pem)}`,
  ],
  [
    'no_pem_footer',
    'cut at the first real newline, which is what a single-line field does to a multi-line paste',
    (pem) => pem.split('\n')[0] ?? '',
  ],
  [
    'text_after_pem_footer',
    "the JSON field's closing quotation mark and comma pasted with it",
    (pem) => `${escaped(pem)}",`,
  ],
];

function env(privateKey: string): EnvLike {
  return {
    NODE_ENV: 'production',
    FCM_PROJECT_ID: 'mon-releve-test',
    FCM_CLIENT_EMAIL: 'pushes@mon-releve-test.iam.gserviceaccount.com',
    FCM_PRIVATE_KEY: privateKey,
  };
}

/** The base64 body of a PEM: every line between the header and the footer. */
function bodyLines(pem: string): string[] {
  return pem
    .trim()
    .split('\n')
    .filter((line) => !line.startsWith('-----'));
}

describe('R861: readFcmCredentials names the shape that failed', () => {
  for (const [shape, how, paste] of SHAPES) {
    it(`${shape}: ${how}`, () => {
      expect(readFcmCredentials(env(paste(KEY)))).toEqual({
        ok: false,
        code: 'malformed_private_key',
        detail: shape,
      });
    });
  }

  it('the specific cause wins: escaped twice with no trailing newline keeps both PEM lines intact', () => {
    // THIS ONE WAS ACCEPTED BEFORE R861. Without a trailing newline the
    // doubly-escaped key still starts with the header and ends with the
    // footer once restored, so it passed as configured - and every push would
    // then have failed at signing, a deployment away from the cause. A PEM
    // body is base64; a backslash in it is never a key.
    const paste = KEY.trim().replaceAll('\n', String.raw`\\n`);

    expect(readFcmCredentials(env(paste))).toEqual({
      ok: false,
      code: 'malformed_private_key',
      detail: 'backslash_after_restore',
    });
  });

  it('still ACCEPTS a well-formed key, so the shapes above are not refusing everything', () => {
    // R196's other direction, for the same key every shape was built from.
    const read = readFcmCredentials(env(escaped(KEY)));

    expect(read.ok).toBe(true);
  });
});

describe('R861: the startup line names the shape and carries no key material', () => {
  for (const [shape, , paste] of SHAPES) {
    it(`${shape}: named in the line, and not one fragment of the key in it`, () => {
      // The expression instrumentation.ts logs at startup.
      const line = describePushSender(resolvePushSender(env(paste(KEY))));

      expect(line).toContain(`(malformed_private_key: ${shape})`);
      expect(line).toContain('FCM_PRIVATE_KEY');

      // NOT ONE BODY LINE, and not even a 12-character window of the body,
      // which a line could leak without leaking a whole line.
      const body = bodyLines(KEY).join('');

      expect(body.length).toBeGreaterThan(1000);

      for (const bodyLine of bodyLines(KEY)) expect(line).not.toContain(bodyLine);

      for (let start = 0; start + 12 <= body.length; start += 1) {
        const window = body.slice(start, start + 12);

        if (line.includes(window)) {
          throw new Error(`the startup line carries key material at body offset ${start}`);
        }
      }

      // NOTHING KEY-DERIVED AT ALL: the same shape from a different key
      // produces the same line, byte for byte.
      expect(describePushSender(resolvePushSender(env(paste(OTHER_KEY))))).toBe(line);
    });
  }

  it('leaves the other two refusals byte-identical', () => {
    // R861 adds a detail to ONE refusal. The other lines are read by
    // tests/db/scheduled-jobs.test.ts and by anybody grepping a server log.
    const tail =
      'the daily reminder will NOT be scheduled. Reminders are opt-in and nobody is told ' +
      'they stopped, so this refuses rather than reporting sends that reached no device.';

    expect(describePushSender({ ok: false, code: 'not_configured' })).toBe(
      `[push] no push sender (not_configured): ${tail}`,
    );
    expect(describePushSender({ ok: false, code: 'placeholder_credentials' })).toBe(
      `[push] no push sender (placeholder_credentials): ${tail}`,
    );
  });
});
