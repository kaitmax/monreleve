// web/tests/unit/verification/origin.test.ts
//
// The dedicated verification-origin setting. FW-VERIFY (R332).
//
// R332: the QR and the printed verification address appear ONLY when a permanent
// production origin is named, and a releve must never point at localhost, a
// temporary host, or an http origin. This proves the gate opens for exactly a
// believable https origin and stays shut for everything else - which is what
// keeps the default document free of a code, an address and a QR.

import { describe, expect, it } from 'vitest';
import { verificationOrigin, verificationUrlFor } from '@/lib/verification/origin';

describe('verificationOrigin (R332): open only for a believable permanent origin', () => {
  it('is null when unset or blank - the default, so the document prints neither', () => {
    expect(verificationOrigin(undefined)).toBeNull();
    expect(verificationOrigin('')).toBeNull();
    expect(verificationOrigin('   ')).toBeNull();
  });

  it('accepts a bare https origin and returns it with no trailing slash', () => {
    expect(verificationOrigin('https://monreleve.ch')).toBe('https://monreleve.ch');
  });

  it('normalises a single trailing slash away', () => {
    expect(verificationOrigin('https://monreleve.ch/')).toBe('https://monreleve.ch');
  });

  it('refuses http - a releve must not point at a non-permanent origin', () => {
    expect(verificationOrigin('http://monreleve.ch')).toBeNull();
  });

  it('refuses localhost and loopback (R332: never a temporary host)', () => {
    expect(verificationOrigin('https://localhost')).toBeNull();
    expect(verificationOrigin('https://localhost:3000')).toBeNull();
    expect(verificationOrigin('https://127.0.0.1')).toBeNull();
    expect(verificationOrigin('https://app.localhost')).toBeNull();
  });

  it('refuses a value that is not a bare origin', () => {
    expect(verificationOrigin('https://monreleve.ch/verifier')).toBeNull();
    expect(verificationOrigin('https://monreleve.ch/?x=1')).toBeNull();
    expect(verificationOrigin('monreleve.ch')).toBeNull();
    expect(verificationOrigin('not a url at all')).toBeNull();
  });
});

describe('verificationUrlFor', () => {
  it('joins the origin and the code into the verification URL', () => {
    expect(verificationUrlFor('https://monreleve.ch', 'abc123')).toBe(
      'https://monreleve.ch/verifier/abc123',
    );
  });
});
