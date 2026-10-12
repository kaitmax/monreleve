// THROWAWAY - not committed. Mints a session + access/refresh pair per scenario
// account so the dossier can be read back over HTTP and the phone can be signed
// in through the debug session path (R284). Same shape as lib/auth/tokens.ts.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
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
