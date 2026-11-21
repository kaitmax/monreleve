// web/tests/db/annex-device-time.test.ts
//
// AN-ANNEX-TRUTH (R1260, iOS Ruling 6 / Android Ruling 22, A15 Q5).
//
// ============================================================================
// THE DEFECT THIS FILE WAS WRITTEN AGAINST
// ============================================================================
//
// The app stamps clientClaimedAt on EVERY write (R275: EntryRepository.record
// calls deviceClaimNow on each tap), online or not, and the server stores it
// verbatim (lib/entries/write.ts). The annex printed that column under a
// heading saying the day was ENTERED OFFLINE, with a note saying the same - so
// every day recorded in the app, online or not, was printed as entered offline.
// A document that claims more than the record supports, on the surface whose
// whole argument is that it does not.
//
// ============================================================================
// THROUGH THE REAL ENTRY POINTS (R204, R225)
// ============================================================================
//
// The day is written through POST /api/v1/entries's ROUTE HANDLER, with the
// body the Android client sends for a tap while online (EntriesWire.kt's
// EntryWrite: the five required keys and clientClaimedAt, a few seconds before
// the server's receipt). The document is the print page's real component, the
// one the PDF route points Chromium at, rendered with a minted print token -
// the shape tests/db/annex-rendered.test.ts uses.
//
// PRESENCE FIRST (R169, R196): the row is printed, and the device's time IS in
// the column under the heading being judged - so the absence assertion cannot
// pass on a document that hid the column, lost the row, or printed nothing.
// The cell is read by its heading, because a claim seconds before the receipt
// prints the same minute as the server's stamp in the next column.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { DOSSIER_COPY as COPY } from '@/lib/fr/dossier';
import { mintPrintToken } from '@/lib/export/print-token';
import { parisDayOf } from '@/lib/entries/day';
import { formatDate, formatDateTime } from '@/lib/ui/core';
import { POST } from '@/app/api/v1/entries/route';
import PrintPage from '@/app/releve/print/page';
import { text } from '@/tests/support/markup';

const ORIGIN = 'https://monreleve.ch';

/**
 * Any wording that says a day was entered without a connection. The claim is
 * judged on the words, not on one string: a reworded "offline" heading is the
 * same defect.
 */
const OFFLINE_CLAIM = /hors[\s  -]+(?:ligne|connexion)|offline|sans\s+(?:r[eé]seau|connexion)/iu;

/** The inner markup of every `<tag ...>...</tag>` in `html`, in order. */
function inner(html: string, tag: string): string[] {
  const element = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gu');

  return [...html.matchAll(element)].map((match) => match[1] ?? '');
}

/** A cell as the reader sees it: nested tags dropped, React's entities decoded. */
const cellText = (markup: string): string => text(markup.replace(/<[^>]*>/gu, ''));

let html = '';
let day = '';
let claimed = '';

beforeAll(async () => {
  process.env.AUTH_SECRET ??= 'annex-device-time-test-secret';
  await prisma.user.deleteMany();

  const userId = (
    await prisma.user.create({
      data: { email: 'en-ligne@example.com', name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    })
  ).id;
  const bearer = (await issueTokenPair(userId)).accessToken;

  // TODAY in Paris: the day a tap records, never a future one (the route
  // refuses those), and never late - so nothing but the device time is odd
  // about this row.
  const now = new Date();

  day = parisDayOf(now);
  // The app's claim: its own clock at the tap, seconds before the server
  // receives the request - an ONLINE write.
  claimed = new Date(now.getTime() - 4_000).toISOString();

  const response = await POST(
    new Request(`${ORIGIN}/api/v1/entries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
      body: JSON.stringify({
        entries: [
          {
            clientMutationId: '00000000-0000-4000-8000-000000001260',
            dayDate: day,
            portion: 'FULL',
            kind: 'HOME',
            provenance: 'MANUAL',
            clientClaimedAt: claimed,
          },
        ],
      }),
    }),
  );

  // R180: the write landed, as the app's would, before anything is read.
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ok', written: 1 });

  const stored = await prisma.entry.findFirstOrThrow({ where: { userId } });

  expect(stored.clientClaimedAt?.toISOString()).toBe(claimed);
  // ONLINE: the server received it within seconds of the device's claim.
  expect(stored.firstRecordedAt.getTime() - new Date(claimed).getTime()).toBeLessThan(60_000);

  const year = Number(day.slice(0, 4));
  const token = mintPrintToken(userId, year);

  if (token === null) throw new Error('no AUTH_SECRET, so no print token could be minted');

  html = renderToStaticMarkup(await PrintPage({ searchParams: Promise.resolve({ year: String(year), token }) }));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('R1260: a day recorded ONLINE in the app is never printed as entered offline', () => {
  it('PRESENCE FIRST: the row is printed, with the device time in its own column', () => {
    expect(html).toContain(COPY.title);

    const tables = inner(html, 'table').filter((table) =>
      inner(table, 'th').map(cellText).includes(COPY.annex.firstRecordedAt),
    );

    expect(tables, 'exactly one annex table').toHaveLength(1);

    const headings = inner(tables[0] ?? '', 'th').map(cellText);
    const claimColumn = headings.indexOf(COPY.annex.clientClaimedAt);

    expect(claimColumn, 'the annex has the device-time column').toBeGreaterThanOrEqual(0);

    const row = inner(tables[0] ?? '', 'tr')
      .map((markup) => inner(markup, 'td').map(cellText))
      .find((cells) => cells[0] === formatDate(day) && cells.length === headings.length);

    expect(row, `the annex prints the day recorded online (${day})`).toBeDefined();
    expect(row?.[claimColumn], 'the device time, under its own heading').toBe(formatDateTime(claimed));
  });

  it('the heading over that time does not say the day was entered offline', () => {
    const heading = COPY.annex.clientClaimedAt;

    expect(
      heading,
      `the column holding an ONLINE day's device time is headed ${JSON.stringify(heading)}`,
    ).not.toMatch(OFFLINE_CLAIM);
  });

  it('nothing in the rendered document says it was', () => {
    const said = text(html.replace(/<[^>]*>/gu, ' ')).match(OFFLINE_CLAIM);

    expect(said?.[0] ?? null, 'offline wording in a document whose only day was recorded online').toBeNull();
  });
});
