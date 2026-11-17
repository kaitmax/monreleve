// web/tests/unit/verification/database-unreachable.test.ts
//
// FW-VERIFIER-OUTAGE (R1022 as amended by Web Ruling 20, item 4): WHICH ERRORS
// MEAN "THE DATABASE COULD NOT BE REACHED".
//
// AN ALLOW-LIST, ASSERTED IN BOTH DIRECTIONS (R196). The degraded state says
// the verification is temporarily unavailable, so it may be shown only when
// that is what happened. Every other error keeps today's behaviour and throws,
// so a defect is never dressed up as an outage. A list that admitted
// everything would pass the positive half of this file perfectly; the
// controls are what make it a list.
//
// THE SHAPES ARE THE MEASURED ONES (REPORT-FW-VERIFIER-OUTAGE.txt), with the
// lookup's own query through a client built as lib/db/client.ts builds it:
//   P1001 / DatabaseNotReachable  a refused port, an unresolvable host
//   P1008 / SocketTimeout         an address that accepts and never answers
//   P2010 / TableDoesNotExist     a missing table: a CONTROL, not an outage
//   PrismaClientValidationError   a bad argument: a CONTROL, not an outage
// The P1001 and validation cases below are REAL errors from a real client that
// cannot connect (127.0.0.1:1 refuses at once; no database is needed). P1008
// needs a peer that accepts and then goes silent for about 21 s, and P2010 a
// live database, so those two are the real class built with the measured code.

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import {
  UNREACHABLE_CODES,
  describeUnreachable,
  isDatabaseUnreachable,
} from '@/lib/verification/database-unreachable';

/** A client whose every query fails to connect: nothing listens on port 1. */
const unreachable = new PrismaClient({
  adapter: new PrismaPg({ connectionString: 'postgresql://probe:probe@127.0.0.1:1/monreleve_probe?schema=public' }),
});

afterAll(async () => {
  await unreachable.$disconnect();
});

/** The lookup's own query (lib/verification/lookup.ts), on the client above. */
async function errorOf(query: () => Promise<unknown>): Promise<unknown> {
  try {
    await query();
  } catch (error) {
    return error;
  }

  throw new Error('the query resolved; a client on 127.0.0.1:1 must not reach a database');
}

const known = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError(`measured shape ${code}`, {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });

describe('the allow-list admits the connection-level causes that were measured', () => {
  it('admits a REAL refused connection: P1001, DatabaseNotReachable', async () => {
    const error = await errorOf(() =>
      unreachable.issuanceRecord.findUnique({ where: { code: '0'.repeat(32) }, select: { name: true } }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(isDatabaseUnreachable(error)).toBe(true);
    // What the page logs: the code and the adapter's own cause, never a guess.
    expect(isDatabaseUnreachable(error) ? describeUnreachable(error) : '').toBe('P1001, DatabaseNotReachable');
  });

  it('admits a socket timeout: P1008', () => {
    expect(isDatabaseUnreachable(known('P1008'))).toBe(true);
    expect(describeUnreachable(known('P1008'))).toBe('P1008');
  });

  it('is exactly those two codes: an entry is added by a measurement, never by habit', () => {
    expect([...UNREACHABLE_CODES]).toEqual(['P1001', 'P1008']);
  });
});

describe('everything else is NOT an outage, and throws as it does today', () => {
  it('refuses a missing table (P2010): a defect of the schema, not of the network', () => {
    expect(isDatabaseUnreachable(known('P2010'))).toBe(false);
  });

  it('refuses a REAL validation error: a bad argument is a defect of the caller', async () => {
    const error = await errorOf(() =>
      // A deliberate type error: the number is what makes Prisma refuse it.
      unreachable.issuanceRecord.findUnique({ where: { code: 42 as unknown as string }, select: { name: true } }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientValidationError);
    expect(isDatabaseUnreachable(error)).toBe(false);
  });

  it('refuses an impostor: the code alone, on something that is not a Prisma error', () => {
    expect(isDatabaseUnreachable(Object.assign(new Error('P1001'), { code: 'P1001' }))).toBe(false);
    expect(isDatabaseUnreachable({ code: 'P1001' })).toBe(false);
    expect(isDatabaseUnreachable('P1001')).toBe(false);
    expect(isDatabaseUnreachable(null)).toBe(false);
    expect(isDatabaseUnreachable(undefined)).toBe(false);
  });

  it('refuses the other Prisma codes a request can carry', () => {
    for (const code of ['P2002', 'P2025', 'P2024', 'P1017', 'P1000']) {
      expect(isDatabaseUnreachable(known(code)), code).toBe(false);
    }
  });
});
