// web/tests/unit/pages/verification-outage-controls.test.ts
//
// FW-VERIFIER-OUTAGE (R1022; Web Ruling 20 item 4): THE PAGE DEGRADES ONLY FOR
// THE ALLOW-LIST, AND EVERY OTHER ERROR KEEPS TODAY'S BEHAVIOUR.
//
// The companion file drives a real client that cannot connect. This one makes
// the lookup throw each measured shape, so the page's decision is asserted in
// BOTH directions (R196): P1008 takes the degraded path; a missing table
// (P2010), a real validation error and a plain defect are thrown on, unchanged,
// to the framework - today's 500. A code defect is never dressed up as an
// outage.

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { lookup } = vi.hoisted(() => ({
  lookup: { error: null as unknown },
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.21' }),
}));

vi.mock('@/lib/verification/lookup', () => ({
  lookupVerification: async () => {
    throw lookup.error;
  },
}));

import VerifyPage from '@/app/(public)/verifier/[code]/page';
import type { VerificationState } from '@/app/(public)/verifier/[code]/VerificationContent';
import { resetRateLimit } from '@/lib/alerts/rate-limit';

const CODE = 'fedcba9876543210fedcba9876543210';

const known = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError(`measured shape ${code}`, {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });

beforeEach(() => {
  resetRateLimit();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function stateFor(error: unknown): Promise<VerificationState['kind']> {
  lookup.error = error;

  const element = (await VerifyPage({ params: Promise.resolve({ code: CODE }) })) as ReactElement<{
    state: VerificationState;
  }>;

  return element.props.state.kind;
}

describe('the allow-list takes the degraded path', () => {
  it('a socket timeout (P1008) answers the unavailable state', async () => {
    expect(await stateFor(known('P1008'))).toBe('unavailable');
  });
});

describe('every other error is thrown on, as today', () => {
  it('a missing table (P2010) is thrown, the same error', async () => {
    const error = known('P2010');

    await expect(stateFor(error)).rejects.toBe(error);
  });

  it('a REAL validation error is thrown, the same error', async () => {
    const client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: 'postgresql://probe:probe@127.0.0.1:1/monreleve_probe?schema=public' }),
    });
    let error: unknown = null;

    try {
      await client.issuanceRecord.findUnique({ where: { code: 42 as unknown as string }, select: { name: true } });
    } catch (cause) {
      error = cause;
    } finally {
      await client.$disconnect();
    }

    expect(error).toBeInstanceOf(Prisma.PrismaClientValidationError);
    await expect(stateFor(error)).rejects.toBe(error);
  });

  it('a defect of our own is thrown, the same error', async () => {
    const error = new TypeError('a defect, not an outage');

    await expect(stateFor(error)).rejects.toBe(error);
  });
});
