// THROWAWAY (device-walkthroughs) - NOT committed. Probes the R196 DB constraints
// empirically (granularity NOT NULL; EXACT-iff-exactTotal) and creates the
// reproducible partial-state accounts for walkthrough 1, minting a session pair
// per account for the debug session path (R284). Shape copied from _mint-readback.mjs.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const hash = (t) => createHash('sha256').update(t).digest('hex');
const mint = () => randomBytes(32).toString('base64url');
const ACCESS_TTL = 60 * 60 * 1000;
const REFRESH_TTL = 90 * 24 * 60 * 60 * 1000;

async function probe(label, fn) {
  try { await fn(); console.log(`PROBE ${label}: ACCEPTED (no error)`); }
  catch (e) { console.log(`PROBE ${label}: REJECTED -> ${String(e.message).split('\n')[0].slice(0, 160)}`); }
}

// --- R196 constraint probes, on a throwaway row we delete afterwards ---
const probeEmail = 'wt-probe@example.invalid';
await prisma.user.deleteMany({ where: { email: probeEmail } });
const probeUser = await prisma.user.create({ data: { email: probeEmail, canton: 'GE', name: 'Probe' } });
await probe('granularity := NULL', () =>
  prisma.$executeRawUnsafe(`UPDATE "User" SET granularity = NULL WHERE id = $1`, probeUser.id));
await probe('denominatorKind := EXACT with exactTotalWorkDays NULL', () =>
  prisma.$executeRawUnsafe(`UPDATE "User" SET "denominatorKind" = 'EXACT', "exactTotalWorkDays" = NULL WHERE id = $1`, probeUser.id));
await probe('employmentRate := 0 (out of 1-100)', () =>
  prisma.$executeRawUnsafe(`UPDATE "User" SET "employmentRate" = 0 WHERE id = $1`, probeUser.id));
await prisma.user.deleteMany({ where: { email: probeEmail } });

// --- the reproducible partial-state accounts ---
// wt-fresh: brand-new, no canton, no name -> full 8-step onboarding
// wt-noname: canton set, name NULL, everything else defaulted -> asks only NOM
async function ensure(email, data) {
  await prisma.user.deleteMany({ where: { email } });
  return prisma.user.create({ data: { email, ...data } });
}
await ensure('wt-fresh@example.invalid', {});
await ensure('wt-noname@example.invalid', { canton: 'GE', employmentRate: 100, denominatorKind: 'SIMPLIFIED240', granularity: 'DAY' });

const emails = ['wt-fresh@example.invalid', 'wt-noname@example.invalid', 'camille.martin@example.invalid'];
const out = [];
for (const email of emails) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const session = await prisma.deviceSession.create({ data: { userId: user.id } });
  const accessToken = mint();
  const refreshToken = mint();
  const now = Date.now();
  await prisma.sessionToken.createMany({ data: [
    { sessionId: session.id, kind: 'ACCESS', tokenHash: hash(accessToken), expiresAt: new Date(now + ACCESS_TTL) },
    { sessionId: session.id, kind: 'REFRESH', tokenHash: hash(refreshToken), expiresAt: new Date(now + REFRESH_TTL) },
  ]});
  out.push({ email, name: user.name, canton: user.canton, granularity: user.granularity,
    accessToken, refreshToken,
    accessExpiresAt: new Date(now + ACCESS_TTL).toISOString(),
    refreshExpiresAt: new Date(now + REFRESH_TTL).toISOString() });
}
console.log('TOKENS ' + JSON.stringify(out, null, 0));
await prisma.$disconnect();
