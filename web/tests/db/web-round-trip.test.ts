// web/tests/db/web-round-trip.test.ts
//
// R906 / R204: THE WEBSITE'S ROUND TRIP, THROUGH THE REAL ROUTE HANDLERS, WITH
// THE CODE READ OUT OF THE FAKE OUTBOX. FW-WEB-ACCOUNT.
//
// e-mail -> the code the server MAILED (read from the outbox, the way a person
// reads it) -> the session -> the CSV download -> the PDF download -> sign-out
// -> the cookie gone and the downloads refused. Each hop is the handler a
// browser's form posts to, so a form posting to the wrong path, or a cookie
// scoped where the next handler cannot read it, fails here on its first run.
//
// THE BROWSER LEG IS e2e/mon-releve.spec.ts. It cannot read the server's
// outbox and mints its code instead (e2e/support/database.ts states the seam);
// THIS file is where "the code from the fake outbox" is proven.
//
// THE PDF NEEDS A LIVE SERVER, like tests/db/export-pdf.test.ts: Chromium
// renders /releve/print over HTTP. Without one the PDF hop is SKIPPED, loudly
// in the suite's name (R133), and every other hop still runs.

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db/client';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { currentTaxYear } from '@/lib/content/tax-year';
import { ACCOUNT_PARAMS, ACCOUNT_PATHS, YEAR_FIELD } from '@/lib/web-account/paths';
import { accountYears } from '@/lib/web-account/year';
import { accountSessionFrom } from '@/lib/web-account/session';
import { POST as csvRoute } from '@/app/(account)/mon-releve/export/csv/route';
import { POST as pdfRoute } from '@/app/(account)/mon-releve/export/pdf/route';
import { liveOrigin } from './support/live-server';
import {
  SITE,
  codeFromOutboxFor,
  cookiePairOf,
  locationOf,
  requestCodeOnSite,
  setCookies,
  signOutOnSite,
  sitePost,
  submitCodeOnSite,
} from '@/tests/support/web-account';

// next/server's after() as a queue: step one sends a known address's mail after
// its response (Web Ruling 37, R1072). tests/support/after-work.ts says why.
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (await import('@/tests/support/after-work')).queueAfter,
}));

const EMAIL = 'round-trip@monreleve.test';
// The year before the current one (Web Ruling 32: the area offers the current tax
// year and the one before). Read from its source, never typed (R171), and the
// earlier of the two so its days are always in the past.
const YEAR = accountYears(currentTaxYear())[1];
const LIVE = await liveOrigin();
const PDF_SUITE =
  'skip' in LIVE ? `R906 the PDF hop - SKIPPED, ${LIVE.skip}` : 'R906 the PDF hop, against a real server';

if ('skip' in LIVE) process.stderr.write(`\n[web-round-trip] R133: the PDF hop did not run - ${LIVE.skip}\n\n`);

let counter = 0;
const mutation = (): string => {
  counter += 1;

  return `00000000-0000-4000-c000-${String(counter).padStart(12, '0')}`;
};

beforeEach(async () => {
  process.env.AUTH_SECRET ??= 'web-round-trip-secret';
  await prisma.user.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.codeAttempt.deleteMany();
  clearOutbox();
  resetRateLimit();

  const user = await prisma.user.create({
    data: { email: EMAIL, name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
  });

  for (const day of [`${String(YEAR)}-03-02`, `${String(YEAR)}-03-03`, `${String(YEAR)}-03-04`]) {
    await prisma.entry.create({
      data: {
        userId: user.id,
        dayDate: new Date(`${day}T00:00:00.000Z`),
        portion: 'FULL',
        kind: 'HOME',
        clientMutationId: mutation(),
      },
    });
  }
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

/** Sign in the way a person does: the address, then the code the MAIL carried. */
async function signIn(): Promise<string> {
  const { step } = await requestCodeOnSite(EMAIL);

  // The code is read off the message the server sent - not minted, not read
  // from the database (where it is only a hash).
  const code = codeFromOutboxFor(EMAIL);
  const response = await submitCodeOnSite(String(step), code);

  expect(response.status).toBe(303);
  expect(locationOf(response).pathname).toBe(ACCOUNT_PATHS.home);
  expect(setCookies(response)).toHaveLength(1);

  return cookiePairOf(String(setCookies(response)[0]));
}

function download(path: string, cookie: string, origin = SITE): Request {
  return sitePost(path, { [YEAR_FIELD]: String(YEAR) }, { cookie, origin });
}

describe('R906: e-mail -> the mailed code -> the session -> the CSV -> sign-out -> refused', () => {
  it('goes all the way round through the handlers', async () => {
    const cookie = await signIn();

    expect(readOutbox()).toHaveLength(1);
    expect(await accountSessionFrom(cookie)).toMatchObject({ state: 'signed-in' });

    // The CSV: bytes, type, a filename that names the year.
    const csv = await csvRoute(download(ACCOUNT_PATHS.exportCsv, cookie));

    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(csv.headers.get('content-disposition')).toContain(String(YEAR));
    expect((await csv.text()).length).toBeGreaterThan(0);

    // Sign-out: the cookie is cleared and the session is over.
    const out = await signOutOnSite(cookie);

    expect(setCookies(out)[0]).toContain('Max-Age=0');
    expect(await accountSessionFrom(cookie)).toEqual({ state: 'ended' });

    // And the old cookie opens nothing: both downloads send it to sign in again.
    for (const route of [csvRoute, pdfRoute]) {
      const refused = await route(download(ACCOUNT_PATHS.exportCsv, cookie));

      expect(refused.status).toBe(303);
      expect(locationOf(refused).pathname).toBe(ACCOUNT_PATHS.signIn);
      expect(locationOf(refused).searchParams.get(ACCOUNT_PARAMS.state)).toBe('session-terminee');
    }
  });

  it('refuses a download posted from another site, even with the cookie (R902)', async () => {
    const cookie = await signIn();

    for (const route of [csvRoute, pdfRoute]) {
      const response = await route(download(ACCOUNT_PATHS.exportCsv, cookie, 'https://evil.example'));

      expect(response.status).toBe(403);
    }

    expect(await prisma.issuanceRecord.count(), 'a refused PDF must record nothing').toBe(0);
  });

  it('sends a download with no session to sign in, and records nothing', async () => {
    const response = await pdfRoute(sitePost(ACCOUNT_PATHS.exportPdf, { [YEAR_FIELD]: String(YEAR) }));

    expect(response.status).toBe(303);
    expect(locationOf(response).pathname).toBe(ACCOUNT_PATHS.signIn);
    expect(await prisma.issuanceRecord.count()).toBe(0);
  });

  // Web Ruling 32 (R1067): the page offers the current tax year and the one
  // before, and nothing else - so a download for any other year did not come
  // from it, and is refused back to the page. Both sides of the window, read
  // from accountYears (R171), never typed.
  it('refuses a year the page does not offer, on either side of the two it does', async () => {
    const cookie = await signIn();
    const [current, previous] = accountYears(currentTaxYear());

    for (const year of [current + 1, previous - 1]) {
      const response = await csvRoute(sitePost(ACCOUNT_PATHS.exportCsv, { [YEAR_FIELD]: String(year) }, { cookie }));

      expect(response.status, String(year)).toBe(303);
      expect(locationOf(response).pathname).toBe(ACCOUNT_PATHS.home);
      expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.export)).toBe('echec');
    }

    // And the two it does offer are served.
    for (const year of [current, previous]) {
      const response = await csvRoute(sitePost(ACCOUNT_PATHS.exportCsv, { [YEAR_FIELD]: String(year) }, { cookie }));

      expect(response.status, String(year)).toBe(200);
    }
  });
});

describe.skipIf('skip' in LIVE)(PDF_SUITE, () => {
  it('downloads the PDF through the account path: a PDF, recorded as an issuance', async () => {
    const cookie = await signIn();
    const origin = 'skip' in LIVE ? SITE : LIVE.origin;
    const request = new Request(`${origin}${ACCOUNT_PATHS.exportPdf}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        host: new URL(origin).host,
        origin,
        cookie,
      },
      body: new URLSearchParams({ [YEAR_FIELD]: String(YEAR) }).toString(),
    });
    const pdf = await pdfRoute(request);
    const bytes = Buffer.from(await pdf.arrayBuffer());

    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(await prisma.issuanceRecord.count()).toBe(1);
  });
});
