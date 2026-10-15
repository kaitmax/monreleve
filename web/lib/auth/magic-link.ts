// web/lib/auth/magic-link.ts
//
// The sign-in token: issued to an address, used once, short-lived.
//
// WHY THIS FILE EXISTS RATHER THAN Auth.js's OWN FLOW. D14: there is no
// signed-in web area. Authentication exists so the Android client can call
// /api/v1, and AC3 requires that no cookie is set anywhere and that /api/v1
// accepts a bearer token and nothing else. Auth.js's route handlers are built
// to set a session cookie and redirect a browser, which is the right design
// for a product that has a signed-in web area and the wrong one for this.
//
// So this product uses Auth.js's ADAPTER and its VerificationToken table -
// the parts that model the data - and issues and consumes the token itself.
// Nothing here mounts an Auth.js handler, so there is no route that can set a
// cookie by accident.
//
// ============================================================================
// THE TOKEN IS CONSUMED IN ONE STATEMENT, AND THAT IS THE POINT OF THE FILE
// ============================================================================
//
// The obvious implementation reads, checks, then deletes:
//
//     const row = await prisma.verificationToken.findUnique(...)
//     if (row === null || row.expires < new Date()) return null
//     await prisma.verificationToken.delete(...)
//     return row.identifier
//
// It passes every sequential test anybody writes. Two requests arriving
// together both pass the findUnique, both delete, and both sign in - once for
// the person who asked and once for whoever else has the URL. None of the ways
// that happens are exotic: a mail forwarded to a colleague, a link-preview
// fetcher that follows URLs before a human does, a phone retrying a tap on a
// bad connection.
//
// `deleteMany` with the whole condition in its WHERE is ONE statement. The row
// is matched and removed in the same breath, so the loser of a race matches
// nothing rather than matching a row that is about to disappear. PostgreSQL
// reports how many rows it actually removed, and that count IS the answer to
// "did I win?".
//
// It is proven by tests/db/magic-link.test.ts firing ten concurrent
// consumptions and requiring exactly one to succeed, and by an ablation in
// REPORT-FW22.txt showing the read-then-delete version failing that test.

import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db/client';

/**
 * How long a sign-in link lives.
 *
 * FIFTEEN MINUTES, and the reasoning rather than a number somebody picked.
 * The link is requested and used within one interaction: a person taps
 * "envoyer le lien", switches to their mail app and taps the link. Anything
 * beyond a few minutes is a window in which a forwarded or intercepted mail
 * is still a working key to somebody's record of where they worked.
 *
 * It is longer than the interaction needs because mail is not instant - a
 * greylisting provider can hold a message for several minutes, and a link
 * that expires before it arrives is a product that does not work.
 */
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

/** Bytes of entropy in the token that travels in the email. */
const TOKEN_BYTES = 32;

/** Digits in the code that travels in the same email. */
const CODE_DIGITS = 6;

/**
 * Wrong-code attempts allowed against one request before it is dead.
 *
 * FIVE, and the reasoning rather than a number somebody picked. Six digits are
 * a million combinations; a guesser who gets five tries per request has a
 * 5-in-a-million chance before the request dies and they must trigger a new
 * email (which the per-address and per-network rate limits bound in turn). Five
 * is also forgiving of a person who fat-fingers one box on a phone: enough
 * retries that a mistype is not a lockout, few enough that guessing is hopeless.
 */
export const MAX_CODE_ATTEMPTS = 5;

/**
 * Code attempts allowed against one ADDRESS per rolling window, across every
 * code issued inside it.
 *
 * TEN, AND THE ARITHMETIC RATHER THAN A NUMBER SOMEBODY PICKED.
 * MAX_CODE_ATTEMPTS above is five per REQUEST, and `issueMagicLink` deletes the
 * previous row on every new request - so asking for a fresh email resets it to
 * zero. Five per code, and codes are free: the per-code limit was never the
 * ceiling, and no test could see that because every test was about one code.
 *
 * What remained was the code route's in-memory window, 20 per 10 minutes:
 * 2 880 guesses a day against one chosen address, out of 10^6 - roughly 0.3 %
 * a day and about 8 % over a month of sustained effort. And weaker than it
 * reads, because an in-memory Map empties on every deploy or restart, so the
 * attacker's real limit was "how often do they deploy".
 *
 * Ten per address per 24 h, counted in PostgreSQL, makes that month about
 * 0.03 %. Ten is also well clear of an honest person: somebody who exhausts
 * one code's five tries, asks for a new one and fat-fingers it twice is at
 * seven, and the LINK in the same email never touches this budget at all.
 */
export const MAX_CODE_ATTEMPTS_PER_DAY = 10;

/**
 * The window the ten are counted over: twenty-four hours, ROLLING.
 *
 * Rolling rather than a calendar day, because a day that resets at midnight
 * hands an attacker twenty attempts across a boundary they can simply wait
 * for.
 *
 * IT IS ALSO THE NUMBER /confidentialite STATES for how long the attempt
 * fingerprints are kept. That page spells the duration out in words, because
 * "au bout de vingt-quatre heures" is the sentence a French reader expects and
 * "au bout de 24 heures" is not. So the two are tied by a test rather than by
 * an expression (R163): tests/db/privacy-claims.test.ts reads the sentence,
 * converts the written number back to hours, and requires it to equal this
 * constant. Move this to 48 and that test fails - which is the property, and
 * the reason this comment does not claim an interpolation that is not there.
 */
export const CODE_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface IssuedMagicLink {
  /** The secret, which exists only in the email. Never stored. */
  readonly token: string;
  /** The six-digit code, which exists only in the email. Never stored in clear. */
  readonly code: string;
  readonly expires: Date;
}

/** Why a code exchange was refused. Each one is named for R198. */
export type CodeRefusal = 'invalid_code' | 'code_expired' | 'too_many_attempts';

/** The outcome of exchanging a code: the address on success, a named refusal otherwise. */
export type CodeResult = { ok: true; email: string } | { ok: false; reason: CodeRefusal };

/**
 * A fresh six-digit code, leading zeros kept.
 *
 * `randomInt` draws from the CSPRNG and is uniform over [0, 1_000_000), so
 * every code from "000000" to "999999" is equally likely - a `Math.random`
 * here would be a predictable code, which is a guessable one.
 */
function generateCode(): string {
  return randomInt(0, 10 ** CODE_DIGITS)
    .toString()
    .padStart(CODE_DIGITS, '0');
}

/**
 * Hash what is stored.
 *
 * THE TABLE MUST NOT BE A LIST OF VALID LINKS. A backup, a support query or a
 * leaked dump would otherwise let the reader sign in as every person with an
 * unexpired link. SHA-256 with no salt is right here and would be wrong for a
 * password: the input is 32 random bytes, so there is no dictionary to attack
 * and no work factor worth paying - what is being defended against is reading
 * the table, not guessing the token.
 */
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a token for an address.
 *
 * IT DOES NOT CHECK WHETHER THE ADDRESS IS REGISTERED, deliberately. That
 * check is what makes a sign-in form an account-enumeration oracle, and AC2
 * requires the response to be identical either way. Whether a user row exists
 * is decided at consumption, out of sight of the caller.
 */
export async function issueMagicLink(email: string): Promise<IssuedMagicLink> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const code = generateCode();
  const expires = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  // A previous unused link for the same address is replaced rather than left
  // alive. Two working links for one person is two chances for the older one
  // to be the one that leaks, and a reader who asks again has told us the
  // first did not reach them. Replacing the row also RESETS the attempt counter
  // - asking again is exactly how a person recovers from a dead request.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  await prisma.verificationToken.create({
    // Both secrets are hashed. The link token and the code are the SAME request:
    // one row, one expiry, consumed in one breath by whichever arrives first.
    data: { identifier: email, token: hash(token), code: hash(code), expires },
  });

  return { token, code, expires };
}

/**
 * Fingerprint of an address, for the budget table.
 *
 * NORMALISED FIRST, because the budget is per PERSON and a person is not two
 * people for having typed a capital letter. The code route already normalises
 * before it calls in; this does it again rather than trusting a caller, since
 * the cost of being wrong is a budget somebody can reset with Shift.
 *
 * SHA-256 AND NOT THE ADDRESS, which is the whole reason the table is
 * publishable (R361). It answers "has this address spent its budget" for an
 * address somebody already holds, and cannot answer "which addresses have
 * tried" for anybody reading the table. See the model's note in schema.prisma.
 *
 * Exported because the erasure path has to delete by the same key, and a
 * second implementation of it there would be a second definition (R206).
 */
export function codeAttemptKey(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/**
 * The advisory-lock class this module owns.
 *
 * The TWO-ARGUMENT form of pg_advisory_xact_lock is a different lock space
 * from the one-argument form, so this cannot collide with pg-boss's locks
 * however its keys are chosen; the class then separates this module's locks
 * from any other two-argument lock a future caller adds.
 */
const CODE_ATTEMPT_LOCK_CLASS = 0x46434150;

/**
 * Claim one slot of the address's rolling budget. True if there was one.
 *
 * ============================================================================
 * WHY A TRANSACTION AND A LOCK, AND NOT ONE CLEVER STATEMENT
 * ============================================================================
 *
 * The obvious implementation is a single conditional insert:
 *
 *     INSERT INTO "CodeAttempt" ... SELECT ... WHERE (SELECT count(*) ...) < 10
 *
 * One statement, atomic, and WRONG under load for a reason that is easy to
 * miss: READ COMMITTED fixes the statement's snapshot before it runs, so two
 * bursts arriving together each count the rows that were committed BEFORE
 * either began. Both see nine, both insert, and the budget is eleven. An
 * advisory lock inside the same statement does not rescue it - by the time the
 * lock is acquired the snapshot is already taken, and the count is of a world
 * that no longer exists.
 *
 * It has to be two statements in one transaction: take the lock, THEN count
 * under a fresh snapshot. That is what this does, and the thirty-parallel
 * burst in tests/db/code-budget.test.ts is what proves it - it granted all
 * thirty before this function existed.
 *
 * THE LOCK IS PER ADDRESS, so two people signing in at the same moment never
 * wait for each other; only a burst against ONE address serialises, which is
 * precisely the case this exists to bound.
 *
 * EXPIRED ROWS FOR THIS ADDRESS GO ON THE WAY IN. The scheduled sweep is the
 * backstop for addresses that never come back; doing it here as well means an
 * address under sustained attack never accumulates more than the window's
 * worth, and that the count below is of the window exactly rather than of the
 * window plus whatever the sweep has not reached yet.
 */
export async function claimCodeAttempt(
  email: string,
  now: number = Date.now(),
): Promise<boolean> {
  const key = codeAttemptKey(email);
  const cutoff = new Date(now - CODE_ATTEMPT_WINDOW_MS);

  return prisma.$transaction(
    async (tx) => {
      // Released when the transaction ends, however it ends - including by the
      // connection dying, which a manually released lock would not survive.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CODE_ATTEMPT_LOCK_CLASS}::int4, hashtext(${key})::int4)`;

      await tx.codeAttempt.deleteMany({
        where: { emailHash: key, attemptedAt: { lt: cutoff } },
      });

      const spent = await tx.codeAttempt.count({
        where: { emailHash: key, attemptedAt: { gte: cutoff } },
      });

      if (spent >= MAX_CODE_ATTEMPTS_PER_DAY) {
        return false;
      }

      // The stamp is the SERVER's, like every stamp in this product: the
      // default on the column, never a value computed here.
      await tx.codeAttempt.create({ data: { emailHash: key } });

      return true;
    },
    // STATED RATHER THAN INHERITED (R345). Prisma's defaults are 2 s to wait
    // for a pool connection and 5 s to finish. A burst against one address
    // serialises on the advisory lock, so the last of thirty waits for
    // twenty-nine sub-millisecond transactions - comfortably inside both
    // defaults, and these are written down so that stays a decision rather
    // than a vendor's number nobody chose.
    { maxWait: 10_000, timeout: 10_000 },
  );
}

/** What one sweep of the attempt table did (R244: what it considered, not that it ran). */
export interface CodeAttemptSweep {
  /** The moment a row had to be older than, ISO. */
  readonly cutoff: string;
  /** Every attempt row in the table, whatever its age. */
  readonly considered: number;
  readonly deleted: number;
}

/**
 * Delete attempt fingerprints that have left the window.
 *
 * WHY A SWEEP AS WELL AS THE DELETE IN `claimCodeAttempt`. That one removes
 * the expired rows of the address it is claiming for, which covers every
 * address that comes back. An address that was attempted once and never again
 * would keep its row for as long as the table lives - and /confidentialite
 * says those traces are erased after twenty-four hours, which is a claim about
 * the TABLE, not about which rows are counted.
 *
 * IT IS HOURLY RATHER THAN DAILY, and that is the whole reason it is its own
 * queue instead of a second statement inside the thirty-day purge. A daily
 * sweep at 03:17 leaves a row created at 04:00 in the table for forty-seven
 * hours, and the page would then be saying something untrue for most of a day.
 *
 * `now` is a parameter so the boundary is testable without waiting a day
 * (R171: the role is "the moment this sweep represents").
 */
export async function purgeCodeAttempts(now: number = Date.now()): Promise<CodeAttemptSweep> {
  const cutoff = new Date(now - CODE_ATTEMPT_WINDOW_MS);

  // COUNTED BEFORE THE DELETE: afterwards the rows are gone, and a census of
  // what survived cannot show a query that matched everything or nothing.
  const considered = await prisma.codeAttempt.count();

  const { count: deleted } = await prisma.codeAttempt.deleteMany({
    where: { attemptedAt: { lt: cutoff } },
  });

  return { cutoff: cutoff.toISOString(), considered, deleted };
}

/** One line for a log, since nobody is watching when this runs. */
export function describeCodeAttemptSweep(sweep: CodeAttemptSweep): string {
  return (
    `[code-attempts] older than ${sweep.cutoff}: ` +
    `considered ${sweep.considered}, deleted ${sweep.deleted}`
  );
}

/**
 * Exchange an address and a six-digit code for the address, consuming the whole
 * request - so the link in the same email no longer works either.
 *
 * NO ENUMERATION. An address with no pending request gets `invalid_code`, the
 * same answer a wrong guess gets, so the endpoint cannot be used to test who has
 * an account - the same guarantee the link callback keeps by collapsing its
 * failures into one. (A VerificationToken row exists for ANY address that
 * requested a link, registered or not, so even `code_expired` and
 * `too_many_attempts` reveal only that a link was requested - which anyone can
 * cause for any address - never that an account exists.)
 *
 * CONSTANT TIME. The submitted code is hashed and compared to the stored hash
 * with `timingSafeEqual`, so the duration of a wrong answer does not leak how
 * many leading digits were right.
 *
 * SINGLE USE UNDER A RACE. The win is decided by the count a conditional
 * `deleteMany` returns, exactly as `consumeMagicLink` decides it, so two correct
 * exchanges arriving together cannot both open a session.
 */
export async function consumeCode(email: string, code: string): Promise<CodeResult> {
  // THE BUDGET IS CLAIMED BEFORE ANYTHING IS READ (R358, R359).
  //
  // Before the row, not merely before the comparison, and the order is the
  // design rather than an accident of where the line landed:
  //
  //   IT MAKES THE REFUSAL IDENTICAL IN EVERY CASE. An attempt against an
  //   address with no outstanding request costs a slot exactly like a wrong
  //   guess against a live one. Spending the slot only when a row exists would
  //   make the budget itself an oracle for "has a code been requested here".
  //
  //   IT IS THE STRICTER READING. An attempt is an attempt; a guesser does not
  //   get a free one for aiming at a request that has already expired.
  //
  // THE PERSON THIS LOCKS OUT STILL HAS A WAY IN, which is what makes a
  // per-address budget acceptable at all: the LINK in the same email never
  // touches this budget, so somebody whose ten were spent by an attacker taps
  // the link instead. That is also why `too_many_attempts` must keep saying
  // what to do next rather than only that the door is shut.
  if (!(await claimCodeAttempt(email))) {
    return { ok: false, reason: 'too_many_attempts' };
  }

  const row = await prisma.verificationToken.findFirst({ where: { identifier: email } });

  if (row === null || row.code === null) {
    return { ok: false, reason: 'invalid_code' };
  }

  if (row.expires.getTime() <= Date.now()) {
    // Swept on the way out, like an expired link: a dead request kept around is
    // a record of a failed sign-in attempt held for no purpose.
    await prisma.verificationToken.deleteMany({ where: { token: row.token } });

    return { ok: false, reason: 'code_expired' };
  }

  // DEAD ALREADY. The counter has reached the limit on a previous call, so the
  // request is spent whatever this code is - including the right one. The row is
  // LEFT so the answer stays "too many attempts, ask for a new one" until it
  // expires or a new request replaces it.
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts' };
  }

  // Claim an attempt slot ATOMICALLY before comparing, so a burst of parallel
  // guesses cannot each read the same low count and get more than the limit
  // allows - each one gets a distinct incremented value from PostgreSQL.
  let claimed;
  try {
    claimed = await prisma.verificationToken.update({
      where: { token: row.token },
      data: { attempts: { increment: 1 } },
    });
  } catch {
    // The row vanished between the read and the update - another exchange
    // consumed it. Nothing to grant.
    return { ok: false, reason: 'invalid_code' };
  }

  if (claimed.attempts > MAX_CODE_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts' };
  }

  const matches =
    claimed.code !== null &&
    timingSafeEqual(Buffer.from(hash(code), 'hex'), Buffer.from(claimed.code, 'hex'));

  if (!matches) {
    return { ok: false, reason: 'invalid_code' };
  }

  // Correct. Consume the whole request in one statement; the count is the
  // answer to "did I win the race".
  const { count } = await prisma.verificationToken.deleteMany({ where: { token: row.token } });

  if (count === 0) {
    return { ok: false, reason: 'invalid_code' };
  }

  return { ok: true, email };
}

/**
 * Consume a token. Returns the address on success, null on every failure.
 *
 * ONE STATEMENT. See the header: the condition that decides whether the token
 * is valid is inside the same WHERE that removes it, so two callers cannot
 * both be told yes. `count` is PostgreSQL reporting what it actually deleted.
 *
 * NULL FOR EVERY FAILURE, with no distinction between "no such token",
 * "expired" and "wrong address". A caller that could tell those apart would
 * hand the same power to anybody probing the endpoint.
 */
export async function consumeMagicLink(email: string, token: string): Promise<string | null> {
  const { count } = await prisma.verificationToken.deleteMany({
    where: {
      identifier: email,
      token: hash(token),
      expires: { gt: new Date() },
    },
  });

  if (count === 0) {
    // An expired row for this address is swept on the way out. Otherwise the
    // table accumulates a record of when somebody tried to sign in and
    // failed, kept for no purpose - which is the opposite of what
    // /confidentialite says this product does with data it does not need.
    await prisma.verificationToken.deleteMany({
      where: { identifier: email, expires: { lte: new Date() } },
    });

    return null;
  }

  return email;
}

/**
 * Compare two tokens without leaking how far they matched.
 *
 * Not used by consumeMagicLink - the database does that comparison - but the
 * refresh-token path in increment 3 needs it, and a second hand-rolled
 * comparison is how one of them ends up using `===`.
 */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
