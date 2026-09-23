// web/scripts/purge-unconfirmed.mjs
//
// `node --env-file-if-exists=.env scripts/purge-unconfirmed.mjs`
//
// The runnable half of AC3's retention rule. The logic is in
// lib/alerts/purge.ts so it can be tested against a real PostgreSQL; this is
// the entry point a person calls by hand.
//
// FW27 SCHEDULED IT, AND THIS STAYS. lib/scheduler/jobs.ts registers the same
// purge on pg-boss, so the promise no longer depends on anybody typing a
// command - but until FW28 deploys that scheduler anywhere, this command is
// the only thing that keeps a sentence the live site already publishes.
//
// ============================================================================
// IT DUPLICATES THE RULE, AND THE DUPLICATION IS BOUNDED RATHER THAN ARGUED
// ============================================================================
//
// A .mjs script cannot import lib/alerts/purge.ts here: `node
// --experimental-strip-types` needs the `.ts` extension on the specifier,
// which `tsc` rejects without `allowImportingTsExtensions`, and the module
// reaches `@/lib/db/client` through an alias plain Node does not resolve.
// lib/db/local-host.ts records the same blocker for the seed.
//
// So tests/unit/meta/purge-script.test.ts READS THIS FILE and asserts that the
// number and the three conditions below match the module's. A comment saying
// the drift is tolerable would not be a mechanism (R185); R181 names what
// happens without one - a transcription is correct on the day it is written
// and silently wrong afterwards, with every suite green.

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

  // COUNTED BEFORE THE DELETE, because afterwards the rows are gone and the
  // census would be of what survived rather than of what was examined.
  const [considered, keptUnsubscribed, keptTooRecent] = await Promise.all([
    prisma.alertSubscriber.count({ where: { confirmedAt: null } }),
    prisma.alertSubscriber.count({
      where: { confirmedAt: null, unsubscribedAt: { not: null }, createdAt: { lt: cutoff } },
    }),
    prisma.alertSubscriber.count({ where: { confirmedAt: null, createdAt: { gte: cutoff } } }),
  ]);

  const { count: deleted } = await prisma.alertSubscriber.deleteMany({
    where: { confirmedAt: null, unsubscribedAt: null, createdAt: { lt: cutoff } },
  });

  // R244: WHAT IT DID, NOT THAT IT RAN. A deletion count alone is a number
  // that can be logged and cannot be read - zero is true of a healthy list
  // with nothing lapsed, and equally true of a query that stopped matching
  // anything. Four numbers that have to add up are not.
  console.log(
    `[purge] older than ${PURGE_AFTER_DAYS} days (${cutoff.toISOString()}): ` +
      `considered ${considered} unconfirmed, deleted ${deleted}, ` +
      `kept ${keptUnsubscribed} unsubscribed and ${keptTooRecent} too recent`,
  );
} finally {
  await prisma.$disconnect();
}
