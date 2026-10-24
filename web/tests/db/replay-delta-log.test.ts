// web/tests/db/replay-delta-log.test.ts
//
// R549 (FW-DOSSIER-EMPTY's addendum): A REPLAY IS MEASURED, AND NOTHING ELSE
// CHANGES.
//
// The operator's ruling on AN-TOKEN-RACE's R510 kept R210 strict - a replayed
// refresh token ends the whole session - and asked for data before deciding
// whether a grace window is warranted: "The server will log the seconds
// between a rotation and its replay, with no ids or tokens, and the window is
// decided from that data after launch."
//
// So when rotateRefreshToken takes THE REPLAY branch it writes ONE line, the
// whole seconds between the token's consumedAt and the replay, and nothing
// that identifies anybody. Everything here goes through the refresh ROUTE
// (R204): the handler is the product, and a test that called the function
// would prove the function.
//
// ============================================================================
// THREE CLAIMS, EACH WITH ITS OTHER SIDE
// ============================================================================
//
//   (a) a replay N seconds after its rotation -> exactly one line, reading N.
//   (b) BOTH DIRECTIONS (R245's shape): a normal rotation, an expired token, an
//       unknown token, and a second replay on an already-ended session -> NO
//       such line. A line that is never written satisfies (b) perfectly; a
//       line that is always written satisfies (a). Together they pin it.
//   (c) THE LINE CARRIES NOTHING IDENTIFYING, and the search that says so is
//       proven able to see each value: planted into a copy of the line, every
//       one of them is found (R180, the plant verified before it is read).
//
// THE CLOCK IS CONTROLLED, not raced. Only `Date` is faked - Prisma's driver
// and vitest's own timers keep the real setTimeout - so the rotation stamps
// consumedAt at a known instant and the replay arrives a known interval later.
// The extra 750 ms is the point of the whole-seconds clause: 37.75 s must read
// 37, so a rounding implementation (38) fails here rather than in production
// data. MORE than half a second on purpose - 250 ms rounds to 37 as well, and
// the first draft of this test used it and could not tell the two apart.

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db/client';
import { REPLAY_DELTA_LOG_PREFIX, issueTokenPair } from '@/lib/auth/tokens';
import { POST as refresh } from '@/app/api/v1/auth/refresh/route';

const ORIGIN = 'https://monreleve.ch';
const EMAIL = 'rejeu@monreleve.test';

/** Request metadata a careless log line might copy. Distinctive, so a search cannot miss it. */
const USER_AGENT = 'MonReleveTest/9.9 (replay-delta-probe)';
const CLIENT_IP = '203.0.113.77';

/** An arbitrary instant, far from any boundary that could matter. */
const T0 = new Date('2026-05-12T09:00:00.000Z');

/** The replay arrives this many whole seconds after the rotation... */
const N = 37;
/** ...plus a fraction that a whole-seconds reading must drop. */
const FRACTION_MS = 750;

let userId = '';
let output: string[] = [];

/** POST /api/v1/auth/refresh as the Android client sends it. */
function refreshWith(refreshToken: string): Promise<Response> {
  return refresh(
    new Request(`${ORIGIN}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': USER_AGENT,
        'x-forwarded-for': CLIENT_IP,
      },
      body: JSON.stringify({ refreshToken }),
    }),
  );
}

/** Every console line written since the last reset, one string per call. */
function capture(): void {
  output = [];

  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      output.push(args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' '));
    });
  }
}

/** The replay-delta lines in what was captured. */
function deltaLines(): string[] {
  return output.filter((line) => line.startsWith(REPLAY_DELTA_LOG_PREFIX));
}

/** The one search used for both the absence and the planted presence (R180). */
function carries(text: string, value: string): boolean {
  return text.includes(value);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);

  await prisma.user.deleteMany();

  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Sam Rejeu' } })).id;

  capture();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Issue, rotate through the route at T0, and return the token a thief would replay. */
async function rotatedOnce(): Promise<{ replayed: string; sessionId: string }> {
  const pair = await issueTokenPair(userId);
  const rotated = await refreshWith(pair.refreshToken);

  // PRESENCE FIRST: the rotation really happened, so what follows is a replay.
  expect(rotated.status).toBe(200);

  return { replayed: pair.refreshToken, sessionId: pair.sessionId };
}

describe('R549 (a): a replay is measured, in whole seconds', () => {
  it('writes exactly one line, and its number is the seconds since the rotation', async () => {
    const { replayed } = await rotatedOnce();

    vi.setSystemTime(new Date(T0.getTime() + N * 1000 + FRACTION_MS));
    output = [];

    const response = await refreshWith(replayed);

    expect(response.status).toBe(401);

    // EXACTLY ONE LINE, and it is the only thing the replay wrote.
    expect(output).toHaveLength(1);
    expect(deltaLines()).toHaveLength(1);

    const [line] = deltaLines();
    const seconds = Number(line?.slice(REPLAY_DELTA_LOG_PREFIX.length));

    // The whole line is the prefix and the number - nothing appended.
    expect(line).toBe(`${REPLAY_DELTA_LOG_PREFIX}${N}`);
    expect(seconds).toBe(N);
  });

  it('changes nothing else: the session still ends, and the answer is byte-identical', async () => {
    // R210 STRICT. The measurement is beside the refusal, never instead of it.
    const { replayed, sessionId } = await rotatedOnce();

    vi.setSystemTime(new Date(T0.getTime() + N * 1000));

    const replay = await refreshWith(replayed);
    const unknown = await refreshWith('not-a-token-anybody-issued');

    const session = await prisma.deviceSession.findUniqueOrThrow({ where: { id: sessionId } });

    expect(session.revokedReason).toBe('TOKEN_REPLAYED');

    // THE SAME ANSWER as any other refused refresh, so a thief learns nothing
    // from it - including that a measurement was taken.
    expect(replay.status).toBe(unknown.status);
    expect(await replay.text()).toBe(await unknown.text());
    expect([...replay.headers.entries()]).toEqual([...unknown.headers.entries()]);
  });
});

describe('R549: a failure to log is not a failure to refuse', () => {
  it('a logger that throws leaves the answer and the revocation exactly as they were', async () => {
    const { replayed, sessionId } = await rotatedOnce();

    // EVERY console method throws from here on - whichever the line uses.
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation(() => {
        throw new Error('the log sink is gone');
      });
    }

    vi.setSystemTime(new Date(T0.getTime() + N * 1000));

    const response = await refreshWith(replayed);
    const session = await prisma.deviceSession.findUniqueOrThrow({ where: { id: sessionId } });

    expect(response.status).toBe(401);
    expect(((await response.json()) as { code: string }).code).toBe('invalid_refresh_token');
    expect(session.revokedReason).toBe('TOKEN_REPLAYED');
  });
});

describe('R549 (b): no line where there was no replay', () => {
  it('a normal rotation writes none', async () => {
    const pair = await issueTokenPair(userId);

    output = [];

    expect((await refreshWith(pair.refreshToken)).status).toBe(200);
    expect(deltaLines()).toEqual([]);
  });

  it('an expired refresh token writes none', async () => {
    const pair = await issueTokenPair(userId);

    await prisma.sessionToken.updateMany({
      where: { sessionId: pair.sessionId, kind: 'REFRESH' },
      data: { expiresAt: new Date(T0.getTime() - 1000) },
    });

    output = [];

    expect((await refreshWith(pair.refreshToken)).status).toBe(401);
    expect(deltaLines()).toEqual([]);
  });

  it('an unknown token writes none', async () => {
    output = [];

    expect((await refreshWith('not-a-token-anybody-issued')).status).toBe(401);
    expect(deltaLines()).toEqual([]);
  });

  it('a second replay on the session the first one ended writes none', async () => {
    // ONE LINE PER ENDED SESSION. The revoked check runs before the consumed
    // one, so the data counts sessions ended by a replay, not retries of it.
    const { replayed } = await rotatedOnce();

    vi.setSystemTime(new Date(T0.getTime() + N * 1000));
    await refreshWith(replayed);

    output = [];

    expect((await refreshWith(replayed)).status).toBe(401);
    expect(deltaLines()).toEqual([]);
  });
});

describe('R549 (c): the line identifies nobody, and the search could have seen it', () => {
  it('carries no token, hash, session, user, email, address or user agent', async () => {
    const { replayed, sessionId } = await rotatedOnce();

    // READ, not recomputed: the hash the database holds for the replayed token.
    const row = await prisma.sessionToken.findFirstOrThrow({
      where: { sessionId, kind: 'REFRESH', consumedAt: { not: null } },
      select: { tokenHash: true },
    });

    vi.setSystemTime(new Date(T0.getTime() + N * 1000));
    output = [];

    await refreshWith(replayed);

    const [line] = deltaLines();

    // PRESENCE FIRST (R169): there is a line to search, or every absence below
    // is satisfied by nothing.
    expect(line).toBeDefined();

    const text = output.join('\n');
    const identifying: ReadonlyArray<readonly [string, string]> = [
      ['the replayed token', replayed],
      ['its hash', row.tokenHash],
      ['the session id', sessionId],
      ['the user id', userId],
      ['the email', EMAIL],
      ['the client address', CLIENT_IP],
      ['the user agent', USER_AGENT],
    ];

    for (const [name, value] of identifying) {
      expect(carries(text, value), `${name} is absent from the output`).toBe(false);

      // THE POSITIVE CONTROL, and the plant is verified before it is read
      // (R180): the copy differs from the line and holds the value, so the
      // search finding it below is the search working, not the plant missing.
      const planted = `${line ?? ''} ${value}`;

      expect(planted, `${name}: the plant changed the copy`).not.toBe(line);
      expect(planted.endsWith(value), `${name}: the plant landed`).toBe(true);
      expect(carries(planted, value), `${name} is found when planted`).toBe(true);
    }
  });
});
