// web/tests/unit/dossier/mode-parity.test.tsx
//
// AN15-AUDIT (R1131; SPEC 21 "Manual mode reaches an identical dossier to auto
// mode from the same days - asserted by a test running both paths"; tasks/todo.md
// AN15 AC2). THE SERVER'S HALF.
//
// The phone's half is android/app/src/test/.../aujourdhui/ModeParityTest.kt: the
// manual and automatic recording paths put the same bytes on the /v1 wire apart
// from provenance, detectedKind and detectedAt. Of those three, the server keeps
// provenance and detectedKind on the entry (detectedAt never reaches the
// document). This file takes the SAME days twice - once as a manual person
// records them, once as an automatic person does (confirmed and corrected
// proposals, plus the days detection never proposes) - and builds from each:
//
//   - the dossier exactly as GET /api/v1/dossier serialises it
//     (DOSSIER_RESPONSE_FIELDS, field by field, as app/api/v1/dossier/route.ts);
//   - the CSV export (toCsv over the annex, as the export route does);
//   - the print document, the HTML Chromium turns into the PDF
//     (app/releve/print/page.tsx, rendered as the server renders it).
//
// THE CLAIM: each pair is BYTE-IDENTICAL once the provenance strings are masked,
// and differs before - so the masking removes something real and nothing else.
// The masks name the provenance VALUES and the print labels by key (R206): the
// print labels are read from DOSSIER_COPY, never retyped.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  type AnnexEntry,
  buildDossier,
  type Dossier,
  DOSSIER_RESPONSE_FIELDS,
  type DossierUser,
} from '@/lib/dossier/service';
import { toCsv } from '@/lib/export/csv';
import { DOSSIER_COPY as COPY } from '@/lib/fr/dossier';

// The print page loads its dossier from the database and its grant from a
// signed token. Both are replaced by the dossier this test built, so the page
// renders exactly that document and nothing else.
let current: Dossier | null = null;

vi.mock('@/lib/dossier/load', () => ({
  buildDossierFor: vi.fn(async () => {
    if (current === null) throw new Error('no dossier staged');

    return current;
  }),
}));

vi.mock('@/lib/export/print-token', () => ({
  readPrintToken: vi.fn((_token: string | null, year: number) => ({ ok: true, userId: 'u-parity', year })),
}));

const { default: PrintPage } = await import('@/app/releve/print/page');

const YEAR = 2026;
const GENERATED_AT = new Date('2026-11-21T09:00:00.000Z');

const USER: DossierUser = {
  name: 'Camille Rey',
  canton: 'GE',
  employmentRate: 100,
  denominatorKind: 'SIMPLIFIED240',
  exactTotalWorkDays: null,
  granularity: 'HALF_DAY',
  activityStartDate: null,
};

type Kind = AnnexEntry['kind'];
type Portion = AnnexEntry['portion'];

/** One recorded day and, for the automatic person, what detection proposed (null: recorded by hand). */
interface Day {
  readonly iso: string;
  readonly kind: Kind;
  readonly portion?: Portion;
  readonly absenceReason?: string;
  readonly proposed: 'CH' | 'HOME' | null;
}

// A year with every kind, both halves, absences, confirmed and corrected
// proposals of each side, and the days an automatic person records by hand
// (detection proposes only CH/HOME). One late recording, so `late` is exercised.
const DAYS: readonly Day[] = (() => {
  const days: Day[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const mm = String(month).padStart(2, '0');

    days.push({ iso: `${YEAR}-${mm}-05`, kind: 'CH', proposed: 'CH' });
    days.push({ iso: `${YEAR}-${mm}-06`, kind: 'HOME', proposed: 'HOME' });
    days.push({ iso: `${YEAR}-${mm}-07`, kind: 'CH', proposed: 'HOME' });
    days.push({ iso: `${YEAR}-${mm}-08`, kind: 'HOME', proposed: 'CH' });
    days.push({ iso: `${YEAR}-${mm}-12`, kind: 'MISSION_FR', proposed: 'CH' });
    days.push({ iso: `${YEAR}-${mm}-13`, kind: 'MISSION_THIRD', proposed: null });
    days.push({ iso: `${YEAR}-${mm}-14`, kind: 'ABSENT', absenceReason: 'MALADIE', proposed: 'HOME' });
    days.push({ iso: `${YEAR}-${mm}-15`, kind: 'ABSENT', absenceReason: 'CONGE', proposed: null });
    days.push({ iso: `${YEAR}-${mm}-19`, kind: 'CH', portion: 'AM', proposed: 'CH' });
    days.push({ iso: `${YEAR}-${mm}-19`, kind: 'HOME', portion: 'PM', proposed: 'HOME' });
  }

  return days;
})();

function entriesFor(mode: 'MANUAL' | 'AUTO'): AnnexEntry[] {
  return DAYS.map((day, index) => {
    const provenance =
      mode === 'MANUAL' || day.proposed === null
        ? 'MANUAL'
        : day.proposed === day.kind
          ? 'DETECTED_CONFIRMED'
          : 'DETECTED_CORRECTED';

    return {
      dayDate: new Date(`${day.iso}T00:00:00.000Z`),
      portion: day.portion ?? 'FULL',
      kind: day.kind,
      absenceReason: day.absenceReason ?? null,
      note: index === 3 ? 'Réunion à Genève' : null,
      provenance,
      detectedKind: provenance === 'MANUAL' ? null : day.proposed,
      // The SAME server stamps on both sides: the server assigns them at
      // receipt, never the mode. The first one is recorded a month late.
      firstRecordedAt:
        index === 0 ? new Date(`${YEAR}-02-20T08:00:00.000Z`) : new Date(`${day.iso}T18:30:00.000Z`),
      lastModifiedAt: null,
      clientClaimedAt: new Date(`${day.iso}T18:29:58.000Z`),
    };
  });
}

/** As app/api/v1/dossier/route.ts serialises it: the frozen field list, field by field. */
function wireOf(dossier: Dossier): string {
  return JSON.stringify(Object.fromEntries(DOSSIER_RESPONSE_FIELDS.map((field) => [field, dossier[field]])));
}

async function printOf(dossier: Dossier): Promise<string> {
  current = dossier;
  const element = await PrintPage({
    searchParams: Promise.resolve({ year: String(YEAR), token: 'staged', generatedAt: GENERATED_AT.toISOString() }),
  });

  return renderToStaticMarkup(element);
}

const PROVENANCE_VALUES = ['MANUAL', 'DETECTED_CONFIRMED', 'DETECTED_CORRECTED'] as const;
const PROVENANCE_LABELS = [
  COPY.annex.provenanceManual,
  COPY.annex.provenanceConfirmed,
  COPY.annex.provenanceCorrected,
] as const;

/** The JSON's provenance strings: the provenance value and the detectedKind value. */
function maskJson(json: string): string {
  return json
    .replace(new RegExp(`"provenance":"(${PROVENANCE_VALUES.join('|')})"`, 'gu'), '"provenance":"*"')
    .replace(/"detectedKind":(null|"[A-Z_]+")/gu, '"detectedKind":"*"');
}

/** The CSV's provenance strings: columns 5 and 6 (provenance, detectedKind). */
function maskCsv(csv: string): string {
  return csv
    .split('\r\n')
    .map((line) => {
      const cells = line.split(',');

      // Only data rows of the recorded kind carry provenance; the header and
      // the gap rows keep their cells as they are (an empty cell stays empty).
      if (cells.length >= 6 && (PROVENANCE_VALUES as readonly string[]).includes(cells[4] ?? '')) {
        cells[4] = '*';
        cells[5] = '*';
      }

      return cells.join(',');
    })
    .join('\r\n');
}

/** The print document's provenance strings: the three labels of the Origine column. */
function maskPrint(html: string): string {
  return PROVENANCE_LABELS.reduce((text, label) => text.split(`<td>${label}</td>`).join('<td>*</td>'), html);
}

afterEach(() => {
  current = null;
});

describe('a manual year and an automatic year of the same days give the same document (R1131)', () => {
  const manual = buildDossier(USER, entriesFor('MANUAL'), YEAR, GENERATED_AT);
  const automatic = buildDossier(USER, entriesFor('AUTO'), YEAR, GENERATED_AT);

  it('stages a non-empty year in both modes, and the automatic one really is automatic', () => {
    expect(manual.recordedEntries).toBe(DAYS.length);
    expect(automatic.recordedEntries).toBe(DAYS.length);

    const provenances = new Set(automatic.annex.filter((row) => row.recorded).map((row) => row.provenance));

    expect([...provenances].sort()).toEqual(['DETECTED_CONFIRMED', 'DETECTED_CORRECTED', 'MANUAL']);
    expect(new Set(manual.annex.filter((row) => row.recorded).map((row) => row.provenance))).toEqual(
      new Set(['MANUAL']),
    );
  });

  it('serialises the same /v1 dossier byte for byte, apart from provenance and detectedKind', () => {
    const left = wireOf(manual);
    const right = wireOf(automatic);

    expect(left).not.toBe(right);
    expect(maskJson(left)).toBe(maskJson(right));
  });

  it('exports the same CSV byte for byte, apart from the provenance and detectedKind columns', () => {
    const left = toCsv(manual.annex);
    const right = toCsv(automatic.annex);

    expect(left).not.toBe(right);
    expect(maskCsv(left)).toBe(maskCsv(right));
  });

  it('prints the same document (the PDF source) byte for byte, apart from the Origine labels', async () => {
    const left = await printOf(manual);
    const right = await printOf(automatic);

    // PRESENCE (R169's corollary): the document rendered its annex - every
    // label of the automatic year appears in it - before any equality is read.
    for (const label of PROVENANCE_LABELS) expect(right).toContain(`<td>${label}</td>`);
    expect(left).toContain(`<td>${COPY.annex.provenanceManual}</td>`);

    expect(left).not.toBe(right);
    expect(maskPrint(left)).toBe(maskPrint(right));
  });
});
