// web/tests/unit/web-account/step.test.ts
//
// R901: the sealed step that carries the address from step one to step two.
// It must open for what it sealed, keep the address out of the URL, and open
// for nothing else.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAGIC_LINK_TTL_MS } from '@/lib/auth/magic-link';
import { PLACEHOLDER_SECRET } from '@/lib/export/print-token';
import { STEP_TTL_MS, openStep, sealStep } from '@/lib/web-account/step';

const EMAIL = 'personne@monreleve.test';
const NOW = Date.parse('2026-11-12T09:00:00.000Z');

let saved: string | undefined;

beforeEach(() => {
  saved = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'step-test-secret-not-the-placeholder';
});

afterEach(() => {
  if (saved === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = saved;
});

describe('a seal opens for what it sealed', () => {
  it('returns the address', () => {
    expect(openStep(sealStep(EMAIL, NOW), NOW + 1000)).toBe(EMAIL);
  });

  it('lives exactly as long as the code it belongs to', () => {
    expect(STEP_TTL_MS).toBe(MAGIC_LINK_TTL_MS);

    const sealed = sealStep(EMAIL, NOW);

    expect(openStep(sealed, NOW + STEP_TTL_MS - 1)).toBe(EMAIL);
    expect(openStep(sealed, NOW + STEP_TTL_MS)).toBeNull();
  });
});

describe('the address is not readable from the seal', () => {
  it('carries neither the address nor any recognisable part of it', () => {
    const sealed = String(sealStep(EMAIL, NOW));

    expect(sealed).not.toContain('personne');
    expect(sealed).not.toContain('monreleve');
    expect(Buffer.from(sealed, 'base64url').toString('latin1')).not.toContain('personne');
  });

  it('is URL-safe as it stands', () => {
    expect(String(sealStep(EMAIL, NOW))).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it('differs every time, so two seals of one address cannot be linked', () => {
    expect(sealStep(EMAIL, NOW)).not.toBe(sealStep(EMAIL, NOW));
  });
});

describe('a seal opens for nothing else', () => {
  it('refuses a tampered seal', () => {
    const sealed = String(sealStep(EMAIL, NOW));
    // One character in the middle of the ciphertext, changed to a DIFFERENT
    // one - a replacement that happened to equal the original would be no
    // tamper at all (the first version did exactly that, one run in 64).
    const at = Math.floor(sealed.length / 2);
    const flipped = sealed.slice(0, at) + (sealed[at] === 'A' ? 'B' : 'A') + sealed.slice(at + 1);

    expect(flipped).not.toBe(sealed);

    expect(openStep(flipped, NOW)).toBeNull();
  });

  it('refuses a seal made under another secret', () => {
    const sealed = sealStep(EMAIL, NOW);

    process.env.AUTH_SECRET = 'a-different-secret-entirely';

    expect(openStep(sealed, NOW)).toBeNull();
  });

  it('refuses garbage, empty and absent values', () => {
    expect(openStep('not-a-seal', NOW)).toBeNull();
    expect(openStep('', NOW)).toBeNull();
    expect(openStep(null, NOW)).toBeNull();
    expect(openStep(undefined, NOW)).toBeNull();
    expect(openStep('A'.repeat(2000), NOW)).toBeNull();
  });
});

describe('no key, no seal (R205)', () => {
  it('refuses to seal or open with no secret', () => {
    delete process.env.AUTH_SECRET;

    expect(sealStep(EMAIL, NOW)).toBeNull();
    expect(openStep('anything', NOW)).toBeNull();
  });

  it('refuses the published placeholder as a secret', () => {
    process.env.AUTH_SECRET = PLACEHOLDER_SECRET;

    expect(sealStep(EMAIL, NOW)).toBeNull();
  });
});
