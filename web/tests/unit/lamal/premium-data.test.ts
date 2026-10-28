// web/tests/unit/lamal/premium-data.test.ts
//
// R656 (the FW-COMPARATEUR prompt's R640): THE DATA IS GENERATED, AND A TEST
// RE-DERIVES IT FROM THE SOURCE FILE.
//
// THIS TEST DOES NOT CALL THE GENERATOR. It parses the OFSP file itself, with
// a parser written here, so the committed module is checked by a second
// reading rather than by the code that wrote it - two implementations that
// agree, not one that agrees with itself. Three things:
//
//   1. The committed module names the source file's real SHA-256: the bytes
//      on disk are the bytes it was generated from.
//   2. Three named rows, each re-read from the file. These are the three the
//      report checks BY HAND against the official publication.
//   3. Every premium in the module equals its row in the file, and every
//      France row the module uses is in the module - nothing added, nothing
//      dropped but the two K3 rows PARK-29 names.
//
// It reads docs/sources/primes-lamal, a root outside web/ that git tracks, so
// it passes on a fresh clone (gate:clone) and is unaffected by public/ being
// moved aside (test:clean-tree).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PREMIUMS_2026 } from '@/lib/lamal/premiums-2026.generated';
import { PREMIUMS_2027 } from '@/lib/lamal/premiums-2027.generated';
import type { PremiumYearTable } from '@/lib/lamal/types';

const SOURCES = join(process.cwd(), '..', 'docs', 'sources', 'primes-lamal');

type Row = Record<string, string>;

function read(file: string): { bytes: Buffer; rows: Row[] } {
  const bytes = readFileSync(join(SOURCES, file));
  const [header, ...lines] = bytes
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
  const names = header!.split(',');

  return {
    bytes,
    rows: lines.map((line) => {
      const cells = line.split(',');

      return Object.fromEntries(names.map((name, index) => [name, cells[index] ?? '']));
    }),
  };
}

/** CHF text -> centimes, by string arithmetic (no float). */
const centimes = (text: string): number => {
  const [whole, fraction = ''] = text.split('.');

  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};

const YEARS: {
  table: PremiumYearTable;
  file: string;
  land: string;
  classes: Record<'adult' | 'youngAdult' | 'child', string>;
  withAccident: string;
}[] = [
  {
    table: PREMIUMS_2027,
    file: '2027_Praemien_EU.csv',
    land: 'FR',
    classes: { adult: 'AKA_03_ERW', youngAdult: 'AKA_02_JUG', child: 'AKA_01_KIN' },
    withAccident: 'MIT_UNF',
  },
  {
    table: PREMIUMS_2026,
    file: '2026_Praemien_EU.csv',
    land: 'EU FR',
    classes: { adult: 'AKL-ERW', youngAdult: 'AKL-JUG', child: 'AKL-KIN' },
    withAccident: 'MIT-UNF',
  },
];

describe.each(YEARS)('premiums $table.premiumYear', ({ table, file, land, classes, withAccident }) => {
  const { bytes, rows } = read(file);
  const france = rows.filter((row) => row.Land === land);

  it('was generated from these exact bytes', () => {
    expect(table.sourceFile).toBe(file);
    expect(table.sourceSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  });

  it('holds every France row of the file but the two K3 child rows, and nothing else', () => {
    expect(france).toHaveLength(80);

    const used = france.filter((row) => row.Altersuntergruppe !== 'K3');
    const k3 = france.filter((row) => row.Altersuntergruppe === 'K3');

    expect(k3).toHaveLength(2);
    expect(k3.every((row) => row.Versicherer === '32' && row.Altersklasse === classes.child)).toBe(true);
    expect(used).toHaveLength(table.insurers.length * 6);

    for (const row of used) {
      const insurer = table.insurers.find((entry) => entry.ofsp === Number(row.Versicherer));
      const ageClass = (Object.keys(classes) as (keyof typeof classes)[]).find(
        (key) => classes[key] === row.Altersklasse,
      );

      expect(insurer, `insurer ${row.Versicherer}`).toBeDefined();
      expect(ageClass, `class ${row.Altersklasse}`).toBeDefined();

      const premiums = insurer![ageClass!];
      const value = row.Unfalleinschluss === withAccident ? premiums.withAccident : premiums.withoutAccident;

      expect(value, `${row.Versicherer} ${row.Altersklasse} ${row.Unfalleinschluss}`).toBe(centimes(row['Prämie']!));
    }
  });
});

describe('the three rows checked by hand (REPORT-FW-COMPARATEUR, R656)', () => {
  // Each line below is copied verbatim from the official file, and the report
  // shows the same three read off the published file by a person.
  const rowOf = (file: string, line: string): Row => {
    const found = read(file).rows.find((row) => Object.values(row).join(',') === line);

    if (found === undefined) throw new Error(`not in ${file}: ${line}`);

    return found;
  };

  it('2027, insurer 8, adult, with accident: 750,00 CHF', () => {
    const row = rowOf(
      '2027_Praemien_EU.csv',
      '8,FR,P_OKPEU,2027,2026,PR_REG_0,AKA_03_ERW,MIT_UNF,BASE,BASE,E1,FRASTU_01,FRA_01_E_0300,750.0,1,1,BASE',
    );

    expect(centimes(row['Prämie']!)).toBe(75000);
    expect(PREMIUMS_2027.insurers.find((i) => i.ofsp === 8)!.adult.withAccident).toBe(75000);
  });

  it('2027, insurer 1562, adult, without accident: 209,30 CHF - the lowest adult premium', () => {
    const row = rowOf(
      '2027_Praemien_EU.csv',
      '1562,FR,P_OKPEU,2027,2026,PR_REG_0,AKA_03_ERW,OHN_UNF,BASE,BASE,E1,FRASTU_01,FRA_01_E_0300,209.3,1,1,BASE',
    );

    expect(centimes(row['Prämie']!)).toBe(20930);
    expect(PREMIUMS_2027.insurers.find((i) => i.ofsp === 1562)!.adult.withoutAccident).toBe(20930);
  });

  it('2026, insurer 376, child, with accident: 265,00 CHF', () => {
    const row = rowOf(
      '2026_Praemien_EU.csv',
      '376,EU FR,EU,2026,2025,PR-REG EU0,AKL-KIN,MIT-UNF,BASE,BASE,K1,FRAST1,FRA-0,265,1,1,BASE',
    );

    expect(centimes(row['Prämie']!)).toBe(26500);
    expect(PREMIUMS_2026.insurers.find((i) => i.ofsp === 376)!.child.withAccident).toBe(26500);
  });
});
