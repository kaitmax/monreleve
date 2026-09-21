// web/tests/unit/export/print-token.test.ts
//
// The print token. FW25 increment 2.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_SECRET,
  PRINT_TOKEN_TTL_MS,
  mintPrintToken,
  readPrintToken,
} from '@/lib/export/print-token';

const SECRET = 'a-real-local-secret-for-tests-only';
let saved: string | undefined;

beforeEach(() => {
  saved = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = SECRET;
});

afterEach(() => {
  if (saved === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = saved;
});

describe('a minted token reads back', () => {
  it('round-trips the person and the year', () => {
    const token = mintPrintToken('user-1', 2026);

    expect(token).not.toBeNull();
    expect(readPrintToken(token, 2026)).toEqual({ ok: true, userId: 'user-1', year: 2026 });
  });

  it('carries no readable secret, only a signature over the payload', () => {
    // The payload is base64url, not encryption - a reader can decode it, and
    // that is fine: it holds an id, a year and an expiry, none of which are
    // secret. What they cannot do is CHANGE any of them.
    const token = mintPrintToken('user-1', 2026) ?? '';

    expect(token).not.toContain(SECRET);
  });
});

describe('R198: every refusal names which rule fired', () => {
  it('missing_token when there is none', () => {
    expect(readPrintToken(null, 2026)).toEqual({ ok: false, code: 'missing_token' });
    expect(readPrintToken('', 2026)).toEqual({ ok: false, code: 'missing_token' });
  });

  it('invalid_token for a forged signature', () => {
    const token = mintPrintToken('user-1', 2026) ?? '';
    const [payload] = token.split('.');

    expect(readPrintToken(`${payload}.not-the-signature`, 2026)).toEqual({
      ok: false,
      code: 'invalid_token',
    });
  });

  it('invalid_token when the payload is edited to another person', () => {
    // THE ATTACK THE SIGNATURE EXISTS FOR. Decoding the payload is easy;
    // re-encoding it with a different id must not verify.
    const forged = Buffer.from('someone-else.2026.99999999999999').toString('base64url');
    const token = mintPrintToken('user-1', 2026) ?? '';
    const signature = token.split('.')[1] ?? '';

    expect(readPrintToken(`${forged}.${signature}`, 2026)).toEqual({
      ok: false,
      code: 'invalid_token',
    });
  });

  it('expired_token past the window, and NOT before it', () => {
    // BOTH SIDES. A check that expired everything would pass the first half.
    const minted = Date.now();
    const token = mintPrintToken('user-1', 2026, minted);

    expect(readPrintToken(token, 2026, minted + PRINT_TOKEN_TTL_MS - 1)).toMatchObject({
      ok: true,
    });
    expect(readPrintToken(token, 2026, minted + PRINT_TOKEN_TTL_MS + 1)).toEqual({
      ok: false,
      code: 'expired_token',
    });
  });

  it('wrong_year for a token minted against a different year', () => {
    // AC3's 403. The grant is (person, year), so a 2026 token presented at
    // 2027 is refused rather than quietly serving 2026 under a URL that says
    // 2027 - which would be a document nobody asked for.
    const token = mintPrintToken('user-1', 2026);

    expect(readPrintToken(token, 2027)).toEqual({ ok: false, code: 'wrong_year' });
  });
});

describe('an unconfigured secret refuses rather than falling back', () => {
  it('mints nothing when AUTH_SECRET is unset', () => {
    delete process.env.AUTH_SECRET;

    expect(mintPrintToken('user-1', 2026)).toBeNull();
  });

  it('reports not_configured rather than invalid, which is a different fact', () => {
    delete process.env.AUTH_SECRET;

    expect(readPrintToken('anything', 2026)).toEqual({ ok: false, code: 'not_configured' });
  });

  it('REFUSES THE PLACEHOLDER the example file ships', () => {
    // R133 as a positive guard. A signing key everybody has is not a signing
    // key, and a placeholder copied into a deployment is the ordinary way that
    // happens - so it is rejected by value rather than by hoping.
    process.env.AUTH_SECRET = PLACEHOLDER_SECRET;

    expect(mintPrintToken('user-1', 2026)).toBeNull();
    expect(readPrintToken('anything', 2026)).toEqual({ ok: false, code: 'not_configured' });
  });

  it('accepts a real secret, so the guard is not refusing everything', () => {
    // The other direction: without this, a module that returned null
    // unconditionally would pass all three tests above.
    process.env.AUTH_SECRET = SECRET;

    expect(mintPrintToken('user-1', 2026)).not.toBeNull();
  });
});

describe('a token signed with another key does not verify', () => {
  it('refuses a token minted under a different secret', () => {
    // Rotating AUTH_SECRET invalidates outstanding tokens, which is the
    // correct behaviour and worth asserting: it is what makes rotation a
    // remedy rather than a hope.
    const token = mintPrintToken('user-1', 2026);

    process.env.AUTH_SECRET = 'a-different-secret-entirely';

    expect(readPrintToken(token, 2026)).toEqual({ ok: false, code: 'invalid_token' });
  });
});
