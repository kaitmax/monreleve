// web/tests/db/print-route.test.ts
//
// The print route, rendered. FW25 increment 2.
//
// ============================================================================
// R225 LANDS HERE, AT THE SURFACE THAT RAISES THE QUESTION
// ============================================================================
//
// `DOSSIER_COPY.tiles.workedDaysNote` exists because a reader who counts the
// annex rows and compares them with the *Jours ouvrés* tile finds 261 against
// 240 - the denominator is prorated, not counted.
//
// FW24 could only assert the string existed in lib/fr, which was already true
// and insufficient: the constant was never what was missing. This file renders
// the document and fails if the note is absent WHILE the two figures disagree -
// conditional on the condition, both ways, so a page that always printed it
// would not pass a document where the note is noise.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { prisma } from '@/lib/db/client';
import { DOSSIER_COPY as COPY } from '@/lib/fr/dossier';
import { mintPrintToken } from '@/lib/export/print-token';
import { buildDossierFor } from '@/lib/dossier/load';
import { formatDays } from '@/lib/ui/core';
import PrintPage from '@/app/releve/print/page';

let userId = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-a000-${String(counter).padStart(12, '0')}`;
}

/** Render the page as the server would, and return its HTML. */
async function render(year: number, token: string | null): Promise<string> {
  const element = await PrintPage({
    searchParams: Promise.resolve({
      year: String(year),
      ...(token === null ? {} : { token }),
    }),
  });

  return renderToStaticMarkup(element);
}

async function seed(dayDate: string, overrides: Record<string, unknown> = {}): Promise<void> {
  await prisma.entry.create({
    data: {
      userId,
      dayDate: new Date(`${dayDate}T00:00:00.000Z`),
      portion: 'FULL',
      kind: 'HOME',
      clientMutationId: mutation(),
      ...overrides,
    },
  });
}

beforeEach(async () => {
  process.env.AUTH_SECRET ??= 'print-route-test-secret';
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: { email: 'print@example.com', name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('R225: the note is present where the question is raised', () => {
  it('prints it when the tile and the annex disagree in count', async () => {
    // TWENTY ROWS AGAINST A 240-DAY BASIS. The reader can count one and read
    // the other, and the numbers do not match - which is exactly when the
    // document owes them a sentence.
    for (let d = 1; d <= 20; d += 1) {
      await seed(`2026-03-${String(d).padStart(2, '0')}`);
    }

    const dossier = await buildDossierFor(userId, 2026);

    // THE CONDITION IS ASSERTED FIRST, so this test cannot pass by the two
    // figures happening to agree.
    expect(dossier.annex.length).not.toBe(dossier.tiles.workedDays);

    const html = await render(2026, mintPrintToken(userId, 2026));

    expect(html).toContain(COPY.tiles.workedDaysNote);
  });

  it('prints both figures, so the disagreement is visible rather than implied', async () => {
    // The note answers a question the reader can only ask if they can SEE both
    // numbers. A page that printed the note but not the tile would pass the
    // test above and answer nothing.
    for (let d = 1; d <= 20; d += 1) {
      await seed(`2026-03-${String(d).padStart(2, '0')}`);
    }

    const html = await render(2026, mintPrintToken(userId, 2026));

    expect(html).toContain('240');
    expect(html).toContain(COPY.tiles.workedDays);
  });
});

describe('SPEC 12: the document prints what it must', () => {
  beforeEach(async () => {
    await seed('2026-03-02', { kind: 'CH' });
    await seed('2026-03-03', { kind: 'ABSENT', absenceReason: 'MALADIE' });
    await seed('2026-03-04', { kind: 'MISSION_FR', note: 'Lyon' });
  });

  it('carries all six sections', async () => {
    const html = await render(2026, mintPrintToken(userId, 2026));

    expect(html).toContain(COPY.title);
    expect(html).toContain(COPY.header.canton);
    expect(html).toContain(COPY.tiles.swissDays);
    expect(html).toContain(COPY.zone.declarableLabel);
    expect(html).toContain(COPY.months.caption);
    expect(html).toContain(COPY.annex.heading);
    expect(html).toContain(COPY.footer.notAdvice);
  });

  it('names BOTH thresholds in the zone sentence', async () => {
    const html = await render(2026, mintPrintToken(userId, 2026));

    // The figures, not the rule names: this surface can interpolate.
    expect(html).toMatch(/40(&#x[0-9A-Fa-f]+;|\s|&nbsp;)*%/u);
    expect(html).toContain('49,9');
  });

  it('prints an ABSENCE as a row with its reason', async () => {
    // D28: counted once in the identification block, printed in the annex like
    // any other row, and in no other figure.
    const html = await render(2026, mintPrintToken(userId, 2026));

    expect(html).toContain(COPY.annex.absenceMaladie);
  });

  it('expands the annex - there is no <details> to collapse', async () => {
    // SPEC 12 item 5: "always fully expanded in the PDF". A <details> in a
    // printed document is a row the reader cannot open, so the element is
    // absent rather than open-by-default.
    const html = await render(2026, mintPrintToken(userId, 2026));

    expect(html).not.toContain('<details');
  });

  it('uses NO banned word, asserted on the rendered HTML', async () => {
    // FW24 asserts the ban over the copy module. This asserts it over what the
    // page actually emitted, which is a different claim: a heading or a label
    // added in JSX would bypass the copy module entirely.
    const html = await render(2026, mintPrintToken(userId, 2026));

    for (const banned of ['certifié', 'attesté', 'conforme', 'validé', 'approuvé']) {
      expect(html.toLowerCase(), `${banned} reached the document`).not.toContain(banned);
    }
  });

  it('says déclaré, enregistré or horodaté, so the ban is not silence', async () => {
    const html = await render(2026, mintPrintToken(userId, 2026)).then((h) => h.toLowerCase());

    expect(html).toMatch(/déclar|enregistr|horodat/u);
  });
});

describe('the token gates the document', () => {
  it('refuses with no token at all', async () => {
    await seed('2026-03-02');

    await expect(render(2026, null)).rejects.toThrow();
  });

  it('refuses a token minted for a DIFFERENT year', async () => {
    // The grant is (person, year). A 2026 token must not serve 2027 - nor
    // quietly serve 2026 under a URL that says otherwise.
    await seed('2026-03-02');

    await expect(render(2027, mintPrintToken(userId, 2026))).rejects.toThrow();
  });

  it('serves the document for a valid token, so the guard is not refusing all', async () => {
    await seed('2026-03-02');

    await expect(render(2026, mintPrintToken(userId, 2026))).resolves.toContain(COPY.title);
  });
});

describe('R230: the document is the record, and carries the note unaltered', () => {
  // The other bound. SPEC 12 makes the PDF the evidence document, so a note
  // rendered here is what an auditor reads - and a mitigation that belongs to
  // a spreadsheet must not reach it.
  //
  // INCREMENT 3 EXTENDS THIS TO THE PRODUCED PDF. This asserts the HTML the
  // renderer is pointed at, which is the honest claim while no PDF exists; the
  // same assertion over extracted PDF text is what proves it end to end.

  it('prints a formula-shaped note exactly as written', async () => {
    await seed('2026-03-02', { note: '=1+1' });

    const html = await render(2026, mintPrintToken(userId, 2026));

    expect(html).toContain('=1+1');
    expect(html).not.toContain("'=1+1");
  });
});

describe('SPEC 12 item 1: the header states the period it actually computed', () => {
  // The defect this replaces stated something FALSE rather than omitting
  // something true: prorated figures under "Année 2026 entière". Both
  // directions are asserted, because a renderer that always printed the
  // part-year line would pass a test for the part-year case alone.

  it('says the whole year when nothing prorated it', async () => {
    await seed('2026-03-02');

    const html = await render(2026, mintPrintToken(userId, 2026));

    expect(html).toContain(COPY.header.fullYear(2026));
  });

  it('says the span when the basis was prorated, and NOT the whole year', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { activityStartDate: new Date('2026-07-01T00:00:00.000Z') },
    });
    await seed('2026-09-02');

    const html = await render(2026, mintPrintToken(userId, 2026));

    expect(html).toContain(COPY.header.fromDate('01.07.2026', 2026));

    // THE HALF THAT MATTERS. Printing the span while ALSO printing "année
    // entière" somewhere would be the same contradiction in a longer form.
    expect(html).not.toContain(COPY.header.fullYear(2026));
  });
});

describe('R239: the document states how far the reader is from each threshold', () => {
  // ==========================================================================
  // THE PRODUCT'S OPENING SENTENCE, PRINTED AT LAST
  // ==========================================================================
  //
  // "how many telework days are left before the 40 % fiscal threshold and the
  // 49,9 % social-security threshold". The payload carried both figures and
  // the page used them ONLY as comparisons to choose a badge - so the rail
  // positioned the reader between two ticks and the document never said how
  // far. R238's first run found the labels sitting unrendered.

  it('prints both headroom figures under the thresholds sentence', async () => {
    await seed('2026-03-02');

    const html = await render(2026, mintPrintToken(userId, 2026));

    expect(html).toContain(COPY.zone.remainingToFiscal);
    expect(html).toContain(COPY.zone.remainingToSocial);
  });

  it('reports a BREACH as a distance above, never as a minus sign or a zero', async () => {
    // SPEC 7.2 step 6 / R12: negatives are reported, never clamped. This is
    // the state a reader in trouble is actually in, and the one a naive render
    // gets wrong - `-6,5` reads as a formatting artefact and `0` is a lie.
    // 170 calendar days is about 121 weekdays, against a 96-day fiscal
    // ceiling (240 x 40 %). The first attempt used 130 and produced 92 - four
    // days SHORT of a breach, which the presence assertion below caught.
    for (let day = 1; day <= 170; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1) + (day - 1) * 86_400_000);
      const weekday = date.getUTCDay();

      if (weekday === 0 || weekday === 6) continue;

      await seed(date.toISOString().slice(0, 10));
    }

    const dossier = await buildDossierFor(userId, 2026);

    // PRESENCE FIRST: the fixture must actually be over the ceiling, or the
    // assertions below are about a state the document never entered.
    expect(dossier.zone.remainingToFiscal).toBeLessThan(0);

    const html = await render(2026, mintPrintToken(userId, 2026));

    expect(html).toContain(COPY.zone.overFiscal);
    expect(html).not.toContain(COPY.zone.remainingToFiscal);

    // The magnitude, with no sign character attached to it.
    const magnitude = formatDays(Math.abs(dossier.zone.remainingToFiscal));

    expect(html).toContain(magnitude);
    expect(html).not.toContain(`-${magnitude}`);
  });
});
