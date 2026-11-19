// web/tests/db/web-session.test.ts
//
// R899: THE WEBSITE'S SESSION, IN THE DATABASE. FW-WEB-ACCOUNT.
//
// What the prompt asks, one block each:
//   - a NEW session id on every sign-in (fixation);
//   - sign-out revokes server-side, and a revoked or an expired value is
//     refused;
//   - the life is short and STATED as a value and asserted (R345) - here,
//     against the CHECK constraint the database enforces, read back from the
//     catalogue so the constant and the constraint cannot drift;
//   - constraints in the database where it can express them (R196), BOTH
//     DIRECTIONS, by constraint name.
// And one the prompt implies: "every device" ends the website's session too.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  WEB_SESSION_TTL_MS,
  openWebSession,
  resolveWebSession,
  revokeWebSession,
  webSessionHash,
} from '@/lib/auth/web-session';
import { revokeAllSessions } from '@/lib/auth/tokens';
import { SESSION_COOKIE } from '@/lib/web-account/cookie';

const EMAIL = 'web-session@monreleve.test';
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

let userId = '';

/** Run a write that must fail, and hand back what PostgreSQL said (by name, R196). */
async function rejection(write: Promise<unknown>): Promise<string> {
  try {
    await write;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error('the write was ACCEPTED, and this test exists because it must not be');
}

const HASH = 'a'.repeat(64);

beforeEach(async () => {
  await prisma.user.deleteMany();
  userId = (await prisma.user.create({ data: { email: EMAIL } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe('R345: the life is a stated value, and the three places that hold it agree', () => {
  it('is thirty minutes, written down', () => {
    expect(WEB_SESSION_TTL_MS).toBe(THIRTY_MINUTES_MS);
  });

  it('is the cookie Max-Age, to the second', () => {
    expect(SESSION_COOKIE.maxAgeSeconds * 1000).toBe(WEB_SESSION_TTL_MS);
  });

  it('is the interval the database CHECK enforces, read from the catalogue', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ def: string }>>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'WebSession_short_life'`,
    );

    expect(rows, 'the WebSession_short_life constraint is missing').toHaveLength(1);

    // PostgreSQL normalises the literal; '00:30:00' is thirty minutes.
    const match = /'(\d{2}):(\d{2}):(\d{2})'::interval/u.exec(rows[0]?.def ?? '');

    expect(match, rows[0]?.def).not.toBeNull();

    const [, h, m, s] = match ?? [];
    const intervalMs = ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000;

    expect(intervalMs).toBe(WEB_SESSION_TTL_MS);
  });
});

describe('a session opened at sign-in', () => {
  it('resolves to its person while it lives', async () => {
    const opened = await openWebSession(userId);
    const resolved = await resolveWebSession(opened.token);

    expect(resolved).toEqual({ ok: true, userId, sessionId: opened.sessionId });
  });

  it('stores the hash, never the value', async () => {
    const opened = await openWebSession(userId);
    const row = await prisma.webSession.findUniqueOrThrow({ where: { id: opened.sessionId } });

    expect(row.tokenHash).toBe(webSessionHash(opened.token));
    expect(row.tokenHash).not.toContain(opened.token);
  });

  it('writes both stamps from one server instant, exactly the life apart', async () => {
    const now = new Date('2026-11-12T09:00:00.000Z');
    const opened = await openWebSession(userId, now);
    const row = await prisma.webSession.findUniqueOrThrow({ where: { id: opened.sessionId } });

    expect(row.createdAt.toISOString()).toBe(now.toISOString());
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(WEB_SESSION_TTL_MS);
  });
});

describe('session fixation: a NEW id and a NEW value on every sign-in', () => {
  it('never reuses a row or a value for the same person', async () => {
    const first = await openWebSession(userId);
    const second = await openWebSession(userId);

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.token).not.toBe(first.token);
    expect(await prisma.webSession.count({ where: { userId } })).toBe(2);
  });

  it('refuses a value nobody minted - a planted cookie matches no row', async () => {
    expect(await resolveWebSession('planted-by-somebody-else-0123456789abcdef')).toEqual({
      ok: false,
      denial: 'unknown',
    });
  });
});

describe('sign-out revokes server-side, and a revoked or expired value is refused', () => {
  it('refuses a value after sign-out, and records why', async () => {
    const opened = await openWebSession(userId);

    await revokeWebSession(opened.token, 'SIGNED_OUT');

    expect(await resolveWebSession(opened.token)).toEqual({ ok: false, denial: 'revoked' });

    const row = await prisma.webSession.findUniqueOrThrow({ where: { id: opened.sessionId } });

    expect(row.revokedReason).toBe('SIGNED_OUT');
    expect(row.revokedAt).not.toBeNull();
  });

  it('refuses a value whose life is over, without anybody revoking it', async () => {
    const opened = await openWebSession(userId, new Date(Date.now() - WEB_SESSION_TTL_MS - 1000));

    expect(await resolveWebSession(opened.token)).toEqual({ ok: false, denial: 'expired' });
  });

  it('keeps the FIRST reason when a revoked session is revoked again', async () => {
    const opened = await openWebSession(userId);

    await revokeWebSession(opened.token, 'SIGNED_OUT');
    await revokeWebSession(opened.token, 'REVOKED_ALL');

    const row = await prisma.webSession.findUniqueOrThrow({ where: { id: opened.sessionId } });

    expect(row.revokedReason).toBe('SIGNED_OUT');
  });

  it('is quiet about an unknown value: signing it out changes nothing', async () => {
    await revokeWebSession('nobody-ever-minted-this-value-000000000000', 'SIGNED_OUT');

    expect(await prisma.webSession.count()).toBe(0);
  });
});

describe('"every device" includes the website (revoke-all)', () => {
  it('ends a live web session along with the device sessions', async () => {
    const opened = await openWebSession(userId);

    await revokeAllSessions(userId, 'REVOKED_ALL');

    expect(await resolveWebSession(opened.token)).toEqual({ ok: false, denial: 'revoked' });

    const row = await prisma.webSession.findUniqueOrThrow({ where: { id: opened.sessionId } });

    expect(row.revokedReason).toBe('REVOKED_ALL');
  });

  it('leaves ANOTHER person signed in', async () => {
    const other = (await prisma.user.create({ data: { email: 'other@monreleve.test' } })).id;
    const theirs = await openWebSession(other);

    await revokeAllSessions(userId, 'REVOKED_ALL');

    expect((await resolveWebSession(theirs.token)).ok).toBe(true);
  });
});

describe('R196: the invariants are constraints, refused by name and accepted when legal', () => {
  const at = new Date('2026-11-12T09:00:00.000Z');
  const plus = (ms: number): Date => new Date(at.getTime() + ms);

  it('refuses a life longer than thirty minutes', async () => {
    const message = await rejection(
      prisma.webSession.create({
        data: { userId, tokenHash: HASH, createdAt: at, expiresAt: plus(THIRTY_MINUTES_MS + 1) },
      }),
    );

    expect(message).toContain('WebSession_short_life');
  });

  it('refuses a session that ends when it begins, or before', async () => {
    const message = await rejection(
      prisma.webSession.create({ data: { userId, tokenHash: HASH, createdAt: at, expiresAt: at } }),
    );

    expect(message).toContain('WebSession_short_life');
  });

  it('accepts exactly thirty minutes, and less', async () => {
    await prisma.webSession.create({
      data: { userId, tokenHash: HASH, createdAt: at, expiresAt: plus(THIRTY_MINUTES_MS) },
    });
    await prisma.webSession.create({
      data: { userId, tokenHash: 'b'.repeat(64), createdAt: at, expiresAt: plus(60_000) },
    });

    expect(await prisma.webSession.count()).toBe(2);
  });

  it('refuses a revocation with no reason, and a reason with no revocation', async () => {
    const noReason = await rejection(
      prisma.webSession.create({
        data: { userId, tokenHash: HASH, createdAt: at, expiresAt: plus(60_000), revokedAt: plus(1000) },
      }),
    );
    const noInstant = await rejection(
      prisma.webSession.create({
        data: { userId, tokenHash: HASH, createdAt: at, expiresAt: plus(60_000), revokedReason: 'SIGNED_OUT' },
      }),
    );

    expect(noReason).toContain('WebSession_revoked_pair');
    expect(noInstant).toContain('WebSession_revoked_pair');
  });

  it('accepts a revocation that names its reason', async () => {
    const row = await prisma.webSession.create({
      data: {
        userId,
        tokenHash: HASH,
        createdAt: at,
        expiresAt: plus(60_000),
        revokedAt: plus(1000),
        revokedReason: 'SIGNED_OUT',
      },
    });

    expect(row.revokedReason).toBe('SIGNED_OUT');
  });

  it('refuses a revocation before the session began', async () => {
    const message = await rejection(
      prisma.webSession.create({
        data: {
          userId,
          tokenHash: HASH,
          createdAt: at,
          expiresAt: plus(60_000),
          revokedAt: plus(-1000),
          revokedReason: 'SIGNED_OUT',
        },
      }),
    );

    expect(message).toContain('WebSession_revoked_after_created');
  });

  it('refuses a token stored in clear - the column holds a hash or nothing', async () => {
    const message = await rejection(
      prisma.webSession.create({
        data: { userId, tokenHash: 'a-cookie-value-stored-as-is', createdAt: at, expiresAt: plus(60_000) },
      }),
    );

    expect(message).toContain('WebSession_token_hash_shape');
  });

  it('refuses two rows with one hash', async () => {
    await prisma.webSession.create({ data: { userId, tokenHash: HASH, createdAt: at, expiresAt: plus(60_000) } });

    const message = await rejection(
      prisma.webSession.create({ data: { userId, tokenHash: HASH, createdAt: at, expiresAt: plus(60_000) } }),
    );

    expect(message).toMatch(/WebSession_tokenHash_key|Unique constraint/u);
  });

  it('goes with the person: deleting the user removes their sessions (cascade)', async () => {
    await openWebSession(userId);
    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.webSession.count()).toBe(0);
  });
});
