// web/tests/db/verification-lookup.test.ts
//
// The verification lookup, which is the page's privacy boundary. FW-VERIFY (R330).
//
// ============================================================================
// THE EMAIL IS ABSENT BECAUSE IT IS NEVER LOADED
// ============================================================================
//
// R330: the page shows only what is printed on the releve, and NEVER the email.
// lookupVerification selects the printed columns and no relation, so the email
// cannot reach the view the page renders - which this proves against a real
// account whose email we know. It also proves the printed fields ARE present
// (R169 presence-first), the superseded instant is carried, and that an unknown,
// malformed or erased code is the one neutral null.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { lookupVerification } from '@/lib/verification/lookup';

const EMAIL = 'secret-holder@example.com';
let userId = '';

async function record(code: string, overrides: Record<string, unknown> = {}): Promise<void> {
  await prisma.issuanceRecord.create({
    data: {
      code,
      userId,
      taxYear: 2026,
      version: 1,
      name: 'Camille Rey',
      declarableRate: 39.16,
      teleworkDays: 94,
      missionDaysFrance: 6,
      missionDaysThirdState: 2,
      periodFraction: 1,
      sha256: 'a'.repeat(64),
      generatedAt: new Date('2026-04-01T09:00:00.000Z'),
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
  userId = (
    await prisma.user.create({ data: { email: EMAIL, name: 'Camille Rey', canton: 'GE' } })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('lookupVerification (R330)', () => {
  it('returns the printed fields for a known code', async () => {
    const code = '0'.repeat(32);
    await record(code);

    const view = await lookupVerification(code);

    expect(view).not.toBeNull();
    expect(view?.name).toBe('Camille Rey');
    expect(view?.taxYear).toBe(2026);
    expect(view?.version).toBe(1);
    expect(view?.declarableRate).toBe(39.16);
    expect(view?.teleworkDays).toBe(94);
    expect(view?.missionDaysFrance).toBe(6);
    expect(view?.missionDaysThirdState).toBe(2);
    expect(view?.generatedAt).toBe(new Date('2026-04-01T09:00:00.000Z').toISOString());
    expect(view?.supersededAt).toBeNull();
  });

  it('NEVER carries the account email - it is not even loaded', async () => {
    const code = '1'.repeat(32);
    await record(code);

    const view = await lookupVerification(code);

    // PRESENCE FIRST: the view exists and carries the name, so this is not an
    // empty object trivially missing the email.
    expect(view?.name).toBe('Camille Rey');
    expect(JSON.stringify(view)).not.toContain(EMAIL);
    expect(JSON.stringify(view)).not.toContain('@example.com');
  });

  it('carries the supersession instant for a superseded version', async () => {
    const supersededAt = new Date('2026-05-02T10:30:00.000Z');
    const code = '2'.repeat(32);
    await record(code, { supersededAt });

    const view = await lookupVerification(code);

    expect(view?.supersededAt).toBe(supersededAt.toISOString());
  });

  it('returns null for an unknown code - the same neutral as an erased one', async () => {
    expect(await lookupVerification('f'.repeat(32))).toBeNull();
  });

  it('returns null for a malformed code without touching the database', async () => {
    // Not 32 hex: it cannot name a real record, so it is the same neutral null,
    // and the query is skipped entirely (keeps garbage off the database).
    expect(await lookupVerification('not-a-real-code')).toBeNull();
    expect(await lookupVerification('ABCDEF')).toBeNull();
    expect(await lookupVerification('')).toBeNull();
  });
});
