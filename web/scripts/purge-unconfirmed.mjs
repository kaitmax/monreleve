// web/scripts/purge-unconfirmed.mjs
//
// `node --env-file-if-exists=.env scripts/purge-unconfirmed.mjs`
//
// The runnable half of AC3's retention rule. The logic is in
// lib/alerts/purge.ts so it can be tested against a real PostgreSQL; this is
// the entry point a scheduler will call.
//
// FW27 OWNS THE SCHEDULE. SPEC 3 names pg-boss, started once in
// instrumentation.ts behind a globalThis guard so hot reload and multiple
// workers do not duplicate it. Until that exists this is a command, and the
// command is what makes the published thirty-day promise something that can
// be kept today rather than a plan.

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const PURGE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const url = process.env.DATABASE_URL;

if (url === undefined || url === '') {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

try {
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * DAY_MS);

  const { count } = await prisma.alertSubscriber.deleteMany({
    where: { confirmedAt: null, unsubscribedAt: null, createdAt: { lt: cutoff } },
  });

  // The count, always - including zero. A job that printed only when it did
  // something is a job whose silence means either "nothing to do" or "never
  // ran", which are the two states a scheduler most needs to tell apart.
  console.log(
    `purge: removed ${count} unconfirmed subscription(s) older than ${PURGE_AFTER_DAYS} days`,
  );
} finally {
  await prisma.$disconnect();
}
