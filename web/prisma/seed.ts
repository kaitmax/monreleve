// web/prisma/seed.ts
//
// `pnpm db:seed`. Local work only.
//
// WHAT IT IS FOR. The confirm page, the unsubscribe page and the capture card
// all render differently depending on the state of a row, and developing them
// against an empty table means creating that state by hand every time the
// database is reset. These four rows are the states that exist.
//
// WHAT IT IS NOT FOR. There is no production path that runs this, and it
// refuses to run against anything but a local database - see the guard below.
// Seeding a real alert list with invented addresses would put mail on its way
// to people who never asked for it.
//
// THE ADDRESSES ARE example.com ON PURPOSE. RFC 2606 reserves it precisely so
// that test data cannot reach a real mailbox; a typo in a domain nobody owns
// is a bounce, and a typo in a real one is a stranger receiving our email.

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DAY = 24 * 60 * 60 * 1000;

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set; copy web/.env.example to web/.env.');
  }

  // THE GUARD. A seed script is a data-writing command with a friendly name,
  // and the cost of running it against the wrong database is other people's
  // email addresses in a table beside four invented ones. Local hosts only,
  // and it says what it refused rather than failing obscurely.
  const host = new URL(url).hostname;

  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    throw new Error(
      `Refusing to seed a non-local database (host: ${host}). This script ` +
        'exists for development and there is no production path that runs it.',
    );
  }

  return url;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: connectionString() }),
});

async function main(): Promise<void> {
  // Idempotent: the seed is run repeatedly during development, and a unique
  // constraint failure on the second run would read as a broken script.
  await prisma.alertSubscriber.deleteMany({
    where: { email: { endsWith: '@example.com' } },
  });

  const now = Date.now();

  await prisma.alertSubscriber.createMany({
    data: [
      {
        // Waiting for the reader to click the link in their email.
        email: 'en-attente@example.com',
        source: 'calculateur',
        confirmationTokenHash: 'seed-unconfirmed-token-hash',
        confirmationExpiresAt: new Date(now + 7 * DAY),
      },
      {
        // On the list. The ordinary case.
        email: 'confirme@example.com',
        source: 'alertes',
        confirmedAt: new Date(now - 30 * DAY),
      },
      {
        // Was on the list and left. The row is kept so that re-subscribing is
        // a decision the record can show.
        email: 'desinscrit@example.com',
        source: 'guide',
        confirmedAt: new Date(now - 60 * DAY),
        unsubscribedAt: new Date(now - 2 * DAY),
      },
      {
        // Old enough for the thirty-day purge to take it (FW14 increment 6),
        // so that job can be watched working against real data.
        email: 'perime@example.com',
        source: 'calculateur',
        createdAt: new Date(now - 31 * DAY),
        confirmationTokenHash: 'seed-expired-token-hash',
        confirmationExpiresAt: new Date(now - 24 * DAY),
      },
    ],
  });

  const rows = await prisma.alertSubscriber.count();

  console.log(`seeded: ${rows} alert subscriber(s) in four states`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
