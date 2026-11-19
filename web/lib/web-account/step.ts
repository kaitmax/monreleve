// web/lib/web-account/step.ts
//
// How the address typed at step one reaches step two. FW-WEB-ACCOUNT (R901).
//
// ============================================================================
// THE PROBLEM: TWO PAGES, NO SCRIPT, NO SECOND COOKIE
// ============================================================================
//
// Sign-in is two forms: an address, then the six-digit code. The code is
// exchanged against the address (consumeCode is keyed by it), so step two must
// know what step one was given. Three ways were open, and two were refused:
//
//   a second cookie     R900 allows the account area exactly ONE cookie, and
//                       it exists only once somebody has proven the code.
//   the address in      a URL lands in browser history, in a proxy's access
//   the query string    log and in a Referer. On this product the address
//                       IS the sensitive fact - "this person is a frontalier"
//                       (lib/auth/request.ts).
//   a sealed value      THIS. The address and an expiry, encrypted and
//                       authenticated with AES-256-GCM under a key derived
//                       from AUTH_SECRET. The URL carries ciphertext; the form
//                       carries it back in a hidden field. No script needed.
//
// WHAT THE SEAL IS NOT: a credential. It holds only what the person typed, and
// opening it proves nothing about them - the CODE is the proof, checked by
// consumeCode against FW-CODE-CAP's budget exactly as for the app. A forged or
// replayed seal names an address its holder could have typed anyway.
//
// IT LIVES AS LONG AS THE CODE, so a seal never outlives the request it
// belongs to.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { MAGIC_LINK_TTL_MS } from '@/lib/auth/magic-link';
import { authSecret } from '@/lib/auth/secret';

/** The seal's life: the code's own (R206 - one number, one home). */
export const STEP_TTL_MS = MAGIC_LINK_TTL_MS;

/** HKDF's info string: this key is for this purpose and no other. */
const PURPOSE = 'monreleve web sign-in step v1';

const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(): Buffer | null {
  const secret = authSecret();

  if (secret === null) return null;

  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), PURPOSE, 32));
}

interface StepPayload {
  readonly e: string;
  readonly x: number;
}

/**
 * Seal an address. Null when no key is configured - the caller refuses the
 * sign-in rather than carrying the address in clear (R205's shape).
 */
export function sealStep(email: string, now: number = Date.now()): string | null {
  const secretKey = key();

  if (secretKey === null) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', secretKey, iv);
  const payload: StepPayload = { e: email, x: now + STEP_TTL_MS };
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);

  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

/**
 * The address inside a seal, or null for anything else: tampered, truncated,
 * sealed under another key, expired, or not a seal at all. One answer for
 * every failure - the page offers to start again whatever went wrong.
 */
export function openStep(sealed: string | null | undefined, now: number = Date.now()): string | null {
  if (typeof sealed !== 'string' || sealed === '' || sealed.length > 1024) return null;

  const secretKey = key();

  if (secretKey === null) return null;

  try {
    const raw = Buffer.from(sealed, 'base64url');

    if (raw.length <= IV_BYTES + TAG_BYTES) return null;

    const decipher = createDecipheriv('aes-256-gcm', secretKey, raw.subarray(0, IV_BYTES));

    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));

    const text = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
    const payload = JSON.parse(text) as Partial<StepPayload>;

    if (typeof payload.e !== 'string' || typeof payload.x !== 'number') return null;
    if (payload.x <= now) return null;

    return payload.e;
  } catch {
    return null;
  }
}
