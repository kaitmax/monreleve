// web/scripts/_mint-readback.mjs
//
// ============================================================================
// A WALKTHROUGH HELPER THAT WRITES, SO IT REFUSES ANY DATABASE THAT IS NOT A
// SCRATCH ONE (R966)
// ============================================================================
//
// WHAT IT DOES. For each scenario account prisma/seed.ts creates, it writes a
// DeviceSession and an ACCESS/REFRESH token pair, then prints the raw tokens
// as one JSON line on stdout, so a walkthrough can read the dossier back over
// HTTP or sign the phone in through the debug session path (R284). The token
// shape is lib/auth/tokens.ts's.
//
// WHERE IT CAME FROM. SEED-RELEVE wrote it on 2026-10-06 as a throwaway headed
// "not committed" (REPORT-SEED-RELEVE.txt). 65c0af6 (FW-SHELL-BURGER,
// 2026-10-12) committed it with other work found uncommitted in the tree.
// FW-DOSSIER-EMPTY ran it again on 2026-10-25, so it is kept, and guarded. The
// sibling that commit brought in with it was removed (R966,
// REPORT-FW-WT-SETUP-GUARD.txt).
//
// WHY THE GUARD. It writes to whatever DATABASE_URL names, and a developer's
// web/.env names the shared development database `frontalier` (C6's NOTICED,
// Queue Ruling 9). So it runs only when DATABASE_URL names a database test:db's
// own guard would admit. The judge and the pattern are imported from their one
// home, lib/db/scratch-database.mjs (R206), never retyped here.
//
// BEFORE CONNECTING, BY CONSTRUCTION. The variable is read once, and that one
// value is both judged and handed to the client. Prisma is imported only after
// the verdict, so a refused run never loads a client at all.
// tests/unit/meta/mint-readback-guard.test.ts runs this file both ways (R196).
//
// stdout carries only the tokens' JSON line, because callers redirect it to a
// file; the verdict goes to stderr. Neither ever carries the URL.

import { createHash, randomBytes } from 'node:crypto';

import { SCRATCH_DATABASE_HOME, SCRATCH_DATABASE_PATTERN, judgeTestDatabase } from '../lib/db/scratch-database.mjs';

const databaseUrl = process.env.DATABASE_URL;
const verdict = judgeTestDatabase(databaseUrl);

if (!verdict.admitted) {
  const pointedAt = verdict.database === null ? '(none)' : JSON.stringify(verdict.database);

  process.stderr.write(
    [
      '',
      '_mint-readback REFUSED (R966): DATABASE_URL does not name a scratch database.',
      '',
      `  pointed at  ${pointedAt}`,
      `  why         ${verdict.reason}`,
      `  requires    ${SCRATCH_DATABASE_PATTERN.source}`,
      `  defined in  ${SCRATCH_DATABASE_HOME}`,
      '',
      'It writes a session and two tokens for every scenario account, so it runs only on a',
      'database made for it. README.md has the recipe for one.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

process.stderr.write(`_mint-readback: DATABASE_URL names ${JSON.stringify(verdict.database)}, a scratch database; minting.\n`);

const { PrismaPg } = await import('@prisma/adapter-pg');
const { PrismaClient } = await import('@prisma/client');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const hash = (t) => createHash('sha256').update(t).digest('hex');
const mint = () => randomBytes(32).toString('base64url');
const ACCESS_TTL = 60 * 60 * 1000;
const REFRESH_TTL = 90 * 24 * 60 * 60 * 1000;

const emails = [
  'camille.martin@example.invalid',
  'alex.dupont@example.invalid',
  'sam.bernard@example.invalid',
];

const out = [];
for (const email of emails) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const session = await prisma.deviceSession.create({ data: { userId: user.id } });
  const accessToken = mint();
  const refreshToken = mint();
  const now = Date.now();
  await prisma.sessionToken.createMany({
    data: [
      { sessionId: session.id, kind: 'ACCESS', tokenHash: hash(accessToken), expiresAt: new Date(now + ACCESS_TTL) },
      { sessionId: session.id, kind: 'REFRESH', tokenHash: hash(refreshToken), expiresAt: new Date(now + REFRESH_TTL) },
    ],
  });
  out.push({
    email,
    accessToken,
    refreshToken,
    accessExpiresAt: new Date(now + ACCESS_TTL).toISOString(),
    refreshExpiresAt: new Date(now + REFRESH_TTL).toISOString(),
  });
}
console.log(JSON.stringify(out, null, 0));
await prisma.$disconnect();
