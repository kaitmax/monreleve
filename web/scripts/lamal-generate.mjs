// web/scripts/lamal-generate.mjs
//
// R656 (the FW-COMPARATEUR prompt's R640): THE PREMIUM DATA IS GENERATED,
// VERSIONED BY YEAR, NEVER HAND-TYPED.
//
// Reads the OFSP file `docs/sources/primes-lamal/<year>_Praemien_EU.csv` and
// writes `web/lib/lamal/premiums-<year>.generated.ts`: the France rows only,
// one entry per insurer, in centimes, with the source file's SHA-256, URL and
// date in the header. Run from web/:
//
//     node scripts/lamal-generate.mjs            # every configured year
//     node scripts/lamal-generate.mjs 2027       # one year
//
// The yearly refresh (premiums are published each autumn for the next year)
// is docs/lamal-refresh.md.
//
// R211: A SCRIPTED EDIT STATES WHAT IT EXPECTS TO MATCH AND REFUSES TO WRITE
// WHEN IT DOES NOT. The two years encode the same thing differently - `FR`
// against `EU FR`, `AKA_03_ERW` against `AKL-ERW`, `FRA_01_E_0300` against
// `FRA-300`, an empty adult subgroup in 2026 - so each year carries an
// EXPLICIT map, and every expectation is asserted before a byte is written:
// the header, the row count, the insurer count, every code value, and that
// each insurer has each of its six cells exactly once. A file that changes
// shape next autumn stops this script with the reason, rather than producing
// a plausible module with a column read from the wrong place.
//
// WHAT IS LEFT OUT, AND WHY. Insurer 32 files two extra child rows under age
// subgroup K3, which the explanations file never defines (PARK-29). They are
// counted and asserted - exactly those two rows - and not used.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = join(WEB, '..', 'docs', 'sources', 'primes-lamal');
const OUT = join(WEB, 'lib', 'lamal');

const HEADER = [
  'Versicherer', 'Land', 'Hoheitsgebiet', 'Geschäftsjahr', 'Erhebungsjahr', 'Region',
  'Altersklasse', 'Unfalleinschluss', 'Tarif', 'Tariftyp', 'Altersuntergruppe',
  'Franchisestufe', 'Franchise', 'Prämie', 'isBaseP', 'isBaseF', 'Tarifbezeichnung',
];

const DATASET_URL = 'https://opendata.swiss/fr/dataset/health-insurance-premiums';

/**
 * One premium year: where its file is, how it spells France and the age
 * classes, and how many France rows it must hold.
 *
 * `classes` maps OUR three classes to the file's codes; `subgroup` is the one
 * age subgroup used per class; `franchise` is the code and the CHF amount it
 * names (asserted to agree).
 */
export const YEARS = {
  2026: {
    file: '2026_Praemien_EU.csv',
    url: 'https://opendata.bagnet.ch (archive Archiv_Praemien_2026.zip, entry Prämien_EU.csv dated 2025-09-23)',
    readOn: '2026-10-27',
    land: 'EU FR',
    territory: 'EU',
    region: 'PR-REG EU0',
    surveyYear: '2025',
    classes: { adult: 'AKL-ERW', youngAdult: 'AKL-JUG', child: 'AKL-KIN' },
    accident: { with: 'MIT-UNF', without: 'OHN-UNF' },
    subgroup: { adult: '', youngAdult: '', child: 'K1' },
    franchise: {
      adult: { code: 'FRA-300', chf: 300 },
      youngAdult: { code: 'FRA-300', chf: 300 },
      child: { code: 'FRA-0', chf: 0 },
    },
    excluded: { subgroup: 'K3', rows: 2 },
    franceRows: 80,
    insurers: 13,
  },
  2027: {
    file: '2027_Praemien_EU.csv',
    url: 'https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0VVLmNzdg%3D%3D',
    readOn: '2026-10-27',
    land: 'FR',
    territory: 'P_OKPEU',
    region: 'PR_REG_0',
    surveyYear: '2026',
    classes: { adult: 'AKA_03_ERW', youngAdult: 'AKA_02_JUG', child: 'AKA_01_KIN' },
    accident: { with: 'MIT_UNF', without: 'OHN_UNF' },
    subgroup: { adult: 'E1', youngAdult: 'J1', child: 'K1' },
    franchise: {
      adult: { code: 'FRA_01_E_0300', chf: 300 },
      youngAdult: { code: 'FRA_01_J_0300', chf: 300 },
      child: { code: 'FRA_01_K_0000', chf: 0 },
    },
    excluded: { subgroup: 'K3', rows: 2 },
    franceRows: 80,
    insurers: 13,
  },
};

/** @param {boolean} condition @param {string} message */
function expect(condition, message) {
  if (!condition) throw new Error(`lamal-generate REFUSED: ${message}`);
}

/**
 * A premium in CHF as the file writes it ("750.0", "697.5", "89.55") to
 * centimes, exactly - no float multiplication.
 *
 * @param {string} text
 */
export function toCentimes(text) {
  expect(/^\d+(\.\d{1,2})?$/.test(text), `premium "${text}" is not a CHF amount`);
  const [whole, fraction = ''] = text.split('.');

  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/**
 * The pure half: CSV text in, the year's table out. Throws on any surprise.
 *
 * @param {string} csvText
 * @param {number} year
 */
export function deriveYear(csvText, year) {
  const config = YEARS[year];
  expect(config !== undefined, `no configuration for premium year ${year}`);

  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line !== '');
  expect(!csvText.includes('"'), 'the file contains a quote; this parser splits on commas only');
  const header = lines[0].split(',');
  expect(JSON.stringify(header) === JSON.stringify(HEADER), `unexpected header: ${lines[0]}`);

  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    expect(cells.length === HEADER.length, `row of ${cells.length} cells: ${line}`);

    return Object.fromEntries(HEADER.map((name, index) => [name, cells[index]]));
  });

  const france = rows.filter((row) => row.Land === config.land);
  expect(france.length === config.franceRows, `${france.length} France rows, expected ${config.franceRows}`);

  for (const row of france) {
    expect(row.Hoheitsgebiet === config.territory, `territory ${row.Hoheitsgebiet}`);
    expect(row.Region === config.region, `region ${row.Region}`);
    expect(row['Geschäftsjahr'] === String(year), `premium year ${row['Geschäftsjahr']}`);
    expect(row.Erhebungsjahr === config.surveyYear, `survey year ${row.Erhebungsjahr}`);
    expect(row.Tarif === 'BASE' && row.Tariftyp === 'BASE', `tariff ${row.Tarif}/${row.Tariftyp}`);
    expect(row.isBaseP === '1' && row.isBaseF === '1', 'a non-base tariff or franchise');
  }

  const classOf = Object.fromEntries(Object.entries(config.classes).map(([ours, theirs]) => [theirs, ours]));
  const insurers = new Map();
  let excluded = 0;

  for (const row of france) {
    const ageClass = classOf[row.Altersklasse];
    expect(ageClass !== undefined, `age class ${row.Altersklasse}`);

    if (ageClass === 'child' && row.Altersuntergruppe === config.excluded.subgroup) {
      excluded += 1;
      continue;
    }

    expect(row.Altersuntergruppe === config.subgroup[ageClass], `subgroup ${row.Altersuntergruppe} for ${ageClass}`);
    expect(row.Franchise === config.franchise[ageClass].code, `franchise ${row.Franchise} for ${ageClass}`);
    expect(
      Number(row.Franchise.replace(/^.*?(\d+)$/, '$1')) === config.franchise[ageClass].chf,
      `franchise code ${row.Franchise} does not name CHF ${config.franchise[ageClass].chf}`,
    );

    const accident =
      row.Unfalleinschluss === config.accident.with ? 'withAccident'
        : row.Unfalleinschluss === config.accident.without ? 'withoutAccident'
          : undefined;
    expect(accident !== undefined, `accident code ${row.Unfalleinschluss}`);

    const ofsp = Number(row.Versicherer);
    expect(Number.isInteger(ofsp) && ofsp > 0, `insurer ${row.Versicherer}`);

    const entry = insurers.get(ofsp) ?? {};
    const cell = `${ageClass}.${accident}`;
    expect(entry[cell] === undefined, `insurer ${ofsp} has ${cell} twice`);
    entry[cell] = toCentimes(row['Prämie']);
    insurers.set(ofsp, entry);
  }

  expect(excluded === config.excluded.rows, `${excluded} ${config.excluded.subgroup} rows, expected ${config.excluded.rows}`);
  expect(insurers.size === config.insurers, `${insurers.size} insurers, expected ${config.insurers}`);

  const cells = ['adult', 'youngAdult', 'child'].flatMap((c) => [`${c}.withAccident`, `${c}.withoutAccident`]);

  return [...insurers.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ofsp, entry]) => {
      for (const cell of cells) expect(entry[cell] !== undefined, `insurer ${ofsp} lacks ${cell}`);

      return {
        ofsp,
        adult: { withAccident: entry['adult.withAccident'], withoutAccident: entry['adult.withoutAccident'] },
        youngAdult: { withAccident: entry['youngAdult.withAccident'], withoutAccident: entry['youngAdult.withoutAccident'] },
        child: { withAccident: entry['child.withAccident'], withoutAccident: entry['child.withoutAccident'] },
      };
    });
}

/**
 * The module text. Deterministic: no clock, no machine path, LF only - so
 * regenerating an unchanged file is a no-op in git.
 *
 * @param {number} year
 * @param {string} sha256
 * @param {ReturnType<typeof deriveYear>} insurers
 */
export function renderModule(year, sha256, insurers) {
  const config = YEARS[year];
  const name = `PREMIUMS_${year}`;
  const rows = insurers
    .map(
      (i) =>
        `    { ofsp: ${i.ofsp}, ` +
        `adult: { withAccident: ${i.adult.withAccident}, withoutAccident: ${i.adult.withoutAccident} }, ` +
        `youngAdult: { withAccident: ${i.youngAdult.withAccident}, withoutAccident: ${i.youngAdult.withoutAccident} }, ` +
        `child: { withAccident: ${i.child.withAccident}, withoutAccident: ${i.child.withoutAccident} } },`,
    )
    .join('\n');

  return [
    `// web/lib/lamal/premiums-${year}.generated.ts`,
    '//',
    '// GENERATED by web/scripts/lamal-generate.mjs. DO NOT EDIT BY HAND (R656).',
    '// tests/unit/lamal/premium-data.test.ts re-derives this file from its source',
    '// and fails on any difference.',
    '//',
    `// Source file:  docs/sources/primes-lamal/${config.file}`,
    `// SHA-256:      ${sha256}`,
    `// Downloaded:   ${config.url}`,
    '// Dataset:      health-insurance-premiums, Federal Office of Public Health (OFSP / BAG)',
    `//               ${DATASET_URL}`,
    '// Terms:        opendata.swiss terms_by - free use, attribution mandatory (R664, row L2)',
    `// Read on:      ${config.readOn}`,
    `// France rows:  Land = ${config.land}; premiums in CHF CENTIMES, per month (R665).`,
    `// Left out:     the ${config.excluded.rows} child rows under subgroup ${config.excluded.subgroup} (PARK-29).`,
    '',
    "import type { PremiumYearTable } from './types';",
    '',
    `export const ${name}: PremiumYearTable = {`,
    `  premiumYear: ${year},`,
    `  sourceFile: '${config.file}',`,
    `  sourceSha256: '${sha256}',`,
    `  readOn: '${config.readOn}',`,
    `  franchiseChf: { adult: ${config.franchise.adult.chf}, youngAdult: ${config.franchise.youngAdult.chf}, child: ${config.franchise.child.chf} },`,
    '  insurers: [',
    rows,
    '  ],',
    '};',
    '',
  ].join('\n');
}

function main() {
  const asked = process.argv.slice(2).map(Number);
  const years = asked.length > 0 ? asked : Object.keys(YEARS).map(Number);

  for (const year of years) {
    const config = YEARS[year];
    expect(config !== undefined, `no configuration for premium year ${year}`);
    const bytes = readFileSync(join(SOURCES, config.file));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const insurers = deriveYear(bytes.toString('utf8'), year);
    const target = join(OUT, `premiums-${year}.generated.ts`);
    writeFileSync(target, renderModule(year, sha256, insurers));
    process.stdout.write(`lamal-generate: ${year} -> ${target} (${insurers.length} insurers, sha256 ${sha256})\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
