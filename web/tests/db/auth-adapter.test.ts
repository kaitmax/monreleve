// web/tests/db/auth-adapter.test.ts
//
// FW22 increment 1, closing P4-1: are FW21's Account, Session and
// VerificationToken tables what the adapter ACTUALLY requires?
//
// R185 - GENERATED OR ASSERTED, NEVER ARGUED. FW21 wrote those three tables
// from the adapter's PUBLISHED schema and parked the verification, because no
// Auth.js package was installed and installing one was out of that task's
// scope. What FW21 had was a careful transcription of documentation with
// nothing connecting it to the artefact - exactly the shape R185 names, and
// exactly the shape that was wrong about `scripts/gate-selection.d.mts`.
//
// THE TYPE LEVEL PROVES ALMOST NOTHING HERE, AND SAYING SO IS THE POINT.
//
// My first draft of this file claimed the opposite: that `PrismaAdapter(prisma)`
// typechecking would catch a column the adapter writes and our schema lacks,
// "without a database". THAT IS FALSE, and it is worth writing down because it
// is the same species of mistake P4-1 exists to correct.
//
//   The adapter's signature is `PrismaAdapter(prisma: PrismaClient | ...)`. It
//   ships as compiled JavaScript plus a .d.ts, so TypeScript never re-checks
//   its BODY against our client. `prisma.account.create(...)` inside the
//   package was typechecked when the package was built, against the adapter
//   author's generic client - not ours. Passing our client satisfies the
//   signature because our client IS a `PrismaClient`; whether that client has
//   an `account` model with the right columns is not a question the signature
//   asks.
//
//   So a schema missing the Account table entirely would COMPILE and fail at
//   the first sign-in.
//
// WHICH MEANS THE RUNTIME TESTS BELOW ARE THE WHOLE OF P4-1's ANSWER. Every
// method FW22's flow will use is CALLED against the real PostgreSQL and its
// row read back. That is the R154 shape - a mechanism proven to deliver -
// and it is the only shape available here.
//
// An assertion that sounds stronger than it is, is worse than one that admits
// its reach: it is the ARGUMENT R185 forbids, wearing a type annotation.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db/client';

// Typed from the INSTALLED package rather than by importing @auth/core
// separately. `@auth/core` is the adapter's own dependency and is not a
// dependency of this project until increment 2 brings next-auth; naming it
// here would be a second description of the same contract, which is the
// R185 defect one step removed. R181: derive it, never restate it.
const adapter: ReturnType<typeof PrismaAdapter> = PrismaAdapter(prisma);

beforeEach(async () => {
  // Account and Session cascade from User; VerificationToken stands alone.
  await prisma.user.deleteMany();
  await prisma.verificationToken.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the installed adapter against FW21 User', () => {
  it('creates a user and reads it back', async () => {
    const created = await adapter.createUser!({
      id: 'adapter-created',
      email: 'adapter@example.com',
      emailVerified: new Date('2026-09-18T10:00:00Z'),
    });

    expect(created.email).toBe('adapter@example.com');

    const fetched = await adapter.getUser!(created.id);

    expect(fetched?.email).toBe('adapter@example.com');
    expect(fetched?.emailVerified?.toISOString()).toBe('2026-09-18T10:00:00.000Z');
  });

  it('finds a user by email, which is how the magic link resolves one', async () => {
    await adapter.createUser!({
      id: 'by-email',
      email: 'trouve@example.com',
      emailVerified: null,
    });

    const found = await adapter.getUserByEmail!('trouve@example.com');

    expect(found?.email).toBe('trouve@example.com');
  });

  it('creates a user with the defaults FW21 chose, not the adapter choosing them', async () => {
    // THE ADAPTER SUPPLIES email AND emailVerified AND NOTHING ELSE. Every
    // other column on User is this product's - canton, employmentRate,
    // denominatorKind, granularity, loggingMode, reminderTime - and each has
    // a default in the schema. If one lost its default, the adapter's insert
    // would fail on a NOT NULL with no value, which is a failure that would
    // first appear at a stranger's first sign-in.
    const created = await adapter.createUser!({
      id: 'defaults',
      email: 'defauts@example.com',
      emailVerified: null,
    });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });

    expect(row.employmentRate).toBe(100);
    expect(row.denominatorKind).toBe('SIMPLIFIED240');
    expect(row.granularity).toBe('DAY');
    expect(row.loggingMode).toBe('MANUAL');
    expect(row.reminderTime).toBe('17:30');
    expect(row.reminderEnabled).toBe(false);
    // Null until the reader says, per FW21's schema comment.
    expect(row.canton).toBeNull();
    expect(row.detectionConsentAt).toBeNull();
  });

  it('updates a user', async () => {
    const created = await adapter.createUser!({
      id: 'to-update',
      email: 'maj@example.com',
      emailVerified: null,
    });

    const updated = await adapter.updateUser!({
      id: created.id,
      emailVerified: new Date('2026-09-18T11:00:00Z'),
    });

    expect(updated.emailVerified?.toISOString()).toBe('2026-09-18T11:00:00.000Z');
  });
});

describe('the installed adapter against FW21 Account and Session', () => {
  it('links an account and finds the user through it', async () => {
    const user = await adapter.createUser!({
      id: 'with-account',
      email: 'compte@example.com',
      emailVerified: null,
    });

    await adapter.linkAccount!({
      userId: user.id,
      type: 'email',
      provider: 'resend',
      providerAccountId: 'compte@example.com',
    });

    const found = await adapter.getUserByAccount!({
      provider: 'resend',
      providerAccountId: 'compte@example.com',
    });

    expect(found?.id).toBe(user.id);
  });

  it('creates, reads and deletes a session', async () => {
    // FW22 issues its own opaque tokens for the Android client rather than
    // using database sessions (D14 - there is no signed-in web area), so this
    // is not the token path. It is here because the adapter's contract
    // includes it: a Session table that does not work is a table that will be
    // found broken by whoever first needs it.
    const user = await adapter.createUser!({
      id: 'with-session',
      email: 'session@example.com',
      emailVerified: null,
    });

    const expires = new Date('2026-12-31T23:59:59Z');

    await adapter.createSession!({ sessionToken: 'jeton-session', userId: user.id, expires });

    const pair = await adapter.getSessionAndUser!('jeton-session');

    expect(pair?.user.id).toBe(user.id);
    expect(pair?.session.expires.toISOString()).toBe(expires.toISOString());

    await adapter.deleteSession!('jeton-session');

    expect(await adapter.getSessionAndUser!('jeton-session')).toBeNull();
  });
});

describe('the installed adapter against FW21 VerificationToken', () => {
  it('stores a token and consumes it exactly once', async () => {
    // THIS IS THE ONE THE MAGIC LINK ACTUALLY RIDES ON, and `useVerificationToken`
    // is specified to DELETE the row as it returns it. Increment 2 proves the
    // race; this proves the adapter's own single-use contract holds against
    // our table.
    const expires = new Date('2026-09-19T10:00:00Z');

    await adapter.createVerificationToken!({
      identifier: 'lien@example.com',
      token: 'jeton-a-usage-unique',
      expires,
    });

    const first = await adapter.useVerificationToken!({
      identifier: 'lien@example.com',
      token: 'jeton-a-usage-unique',
    });

    expect(first?.identifier).toBe('lien@example.com');

    const second = await adapter.useVerificationToken!({
      identifier: 'lien@example.com',
      token: 'jeton-a-usage-unique',
    });

    expect(second).toBeNull();
  });
});

describe('what FW21 deliberately did NOT give the adapter', () => {
  it('has no image column, and the adapter does not need one', async () => {
    // P4-1's open question. The adapter's AdapterUser type carries `image`;
    // nothing in SPEC 8 and nothing in this product displays an avatar, and
    // R187 says an unused column is a promise to a client that will
    // eventually read it. FW21 left it out and could not check.
    //
    // THE CHECK IS THAT THE COLUMN IS ABSENT AND EVERY TEST ABOVE STILL
    // PASSES. If the adapter required it, createUser would have failed at the
    // first test in this file rather than here.
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'User'
      ORDER BY column_name
    `;

    const names = columns.map((column) => column.column_name);

    expect(names).not.toContain('image');
    expect(names).toContain('email');
    expect(names).toContain('emailVerified');
  });
});
