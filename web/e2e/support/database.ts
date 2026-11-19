// web/e2e/support/database.ts
//
// The account-area specs need ONE thing the rest of the e2e suite does not: a
// database row - a person to sign in as. FW-WEB-ACCOUNT (R906).
//
// THE SAME DATABASE THE SERVER USES, AND ONLY A SCRATCH ONE. `next start`
// reads web/.env; this reads the same file when DATABASE_URL is not already
// set, and then refuses unless the name is a scratch database (R877's judge,
// lib/db/scratch-database.mjs) - these specs create and delete users, and the
// shared development database is never a place to do that.
//
// NOT AVAILABLE IS A LOUD SKIP, NEVER A PASS (R133). The reason is printed.
//
// THE SEAM, STATED (advisor ruling for C9; container-auth's HALF B shape). The
// fake outbox lives in the SERVER's memory, and no HTTP surface returns a
// sign-in code - adding one was refused. So a spec cannot read the code the
// server mailed. It does the next most real thing: after the browser has
// asked for a code through the real form, it MINTS a fresh request for the
// same address into the same database - exactly what the mail would have
// carried - and types that. That the mail carries the code is proven
// in-process by tests/db/web-round-trip.test.ts, which reads the outbox.

import { existsSync } from 'node:fs';
import { judgeTestDatabase } from '../../lib/db/scratch-database.mjs';

export type DatabaseVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

let verdict: DatabaseVerdict | null = null;

export function e2eDatabase(): DatabaseVerdict {
  if (verdict !== null) return verdict;

  if ((process.env.DATABASE_URL ?? '') === '' && existsSync('.env')) process.loadEnvFile('.env');

  const judged = judgeTestDatabase(process.env.DATABASE_URL) as { admitted: boolean; reason: string | null };

  verdict = judged.admitted
    ? { ok: true }
    : { ok: false, reason: `the account-area specs need a scratch database: ${String(judged.reason)}` };

  if (!verdict.ok) process.stderr.write(`\n[e2e] R133: account-area specs SKIPPED - ${verdict.reason}\n\n`);

  return verdict;
}

/** The database client, imported only once the URL is known to be a scratch one. */
export async function e2ePrisma(): Promise<typeof import('../../lib/db/client').prisma> {
  return (await import('../../lib/db/client')).prisma;
}

/** An address of this run's own, so the server's in-memory rate limits never carry over (R906). */
export function uniqueAddress(label: string): string {
  return `e2e-${label}-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}@monreleve.test`;
}

/** How long the seam waits for the server's own request row (it is written after the response). */
const SERVER_REQUEST_WAIT_MS = 15_000;

/**
 * A fresh code for an address, minted the way the server mints one. Replaces the mailed request.
 *
 * IT WAITS FOR THE SERVER'S REQUEST FIRST (W12, Web Ruling 37 R1072). Step one now
 * writes a known address's request in next/server's after(), once the response
 * has gone. Minted before that, this code would be the one REPLACED - the
 * server's issuance deletes every earlier row for the address - and the code
 * typed would be refused. The production build in the container showed it: the
 * deferred write landed after the mint. So the seam waits until the server's own
 * row exists, then replaces it, as the mailed code would have been replaced.
 */
export async function mintCode(email: string): Promise<string> {
  const { issueMagicLink } = await import('../../lib/auth/magic-link');
  const prisma = await e2ePrisma();
  const deadline = Date.now() + SERVER_REQUEST_WAIT_MS;

  while ((await prisma.verificationToken.count({ where: { identifier: email } })) === 0) {
    if (Date.now() > deadline) {
      throw new Error(`the server wrote no request for ${email} within ${String(SERVER_REQUEST_WAIT_MS)} ms`);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return (await issueMagicLink(email)).code;
}
