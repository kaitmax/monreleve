// web/lib/alerts/token.ts
//
// The alert flow's link tokens, as primitives. FW-DELAI-RAPPEL (R915)
// EXTRACTED them from record.ts and confirm.ts rather than writing a second
// set: the deadline reminder confirms and deletes by exactly these mechanics -
// 32 random bytes in the link, their SHA-256 in the row, never the token.
//
// record.ts and confirm.ts keep exporting what they exported, so the alert
// tests read the same names from the same modules, untouched.

import { createHash, randomBytes } from 'node:crypto';

/** 32 bytes of randomness, hex-encoded: 64 characters in the link. */
const TOKEN_BYTES = 32;

/** A fresh link token. The plaintext exists only in the message it goes into. */
export function mintToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * SHA-256, and no salt.
 *
 * A password hash needs a slow function and a per-row salt because passwords
 * are low-entropy and reused. This is 256 bits from a CSPRNG, used once: there
 * is no dictionary to attack and no other account it unlocks. What hashing
 * buys here is that a database copy does not contain working links, and
 * SHA-256 buys that completely.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A token and the hash the row keeps. */
export function freshToken(): { readonly token: string; readonly hash: string } {
  const token = mintToken();

  return { token, hash: hashToken(token) };
}
