// web/app/releve/print/page.tsx
//
// The document, rendered. FW25 increment 2.
//
// ============================================================================
// THIS IS THE FIRST TIME THE DOSSIER CAN BE LOOKED AT
// ============================================================================
//
// FW24 built a payload and a copy module and nothing rendered either. Every
// figure below comes from `buildDossierFor`; every word from DOSSIER_COPY.
// Nothing here calculates, and nothing here writes French.
//
// ============================================================================
// IT IS OUTSIDE app/(public) ON PURPOSE
// ============================================================================
//
// The public group carries the site chrome - nav, footer, the shell a reader
// browses. A document does not have navigation. It is also noindex and
// token-gated, so it must not inherit a layout that assumes neither.
//
// ============================================================================
// THE ANNEX IS ALWAYS EXPANDED HERE
// ============================================================================
//
// SPEC §12 item 5: "collapsed on screen, always fully expanded in the PDF". A
// <details> element in a printed document is a row the reader cannot open, so
// there is no <details> on this page at all - not one that is open by default,
// which would still collapse if anybody ever loaded this route in a browser and
// clicked. The screen version is a different surface's problem.
//
// NO CLIENT JS. Nothing here is interactive, and a print route that hydrated
// would be a print route that could render differently in Chromium than in a
// browser - which is the drift SPEC §12 closes by having the PDF and the app
// read the same payload.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DOSSIER_COPY as COPY } from '@/lib/fr/dossier';
import { buildDossierFor } from '@/lib/dossier/load';
import { MissingTitulaireError } from '@/lib/dossier/service';
import { readPrintToken } from '@/lib/export/print-token';
import { ruleSetFor } from '@/lib/calc-engine';
import { formatDays, formatPercent, formatSignedDays, zoneFor } from '@/lib/ui/core';
import { ThresholdRail } from '@/lib/ui/react';
import styles from './print.module.scss';

export const dynamic = 'force-dynamic';

/**
 * NOINDEX, and it is not a nicety.
 *
 * This URL renders one person's tax position. It must never reach an index,
 * and `noarchive`/`nosnippet` stop a crawler that ignored the first word from
 * keeping a copy of the second.
 */
export const metadata: Metadata = {
  title: COPY.title,
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
};

// THERE IS NO percent() HELPER HERE, AND THERE WAS ONE FOR TEN MINUTES.
//
// It did `toFixed(2).replace('.', ',')`, which is a SECOND implementation of
// something lib/ui/core/format/number.ts already owns - and it was wrong in
// two ways the page would have rendered without complaint: an ASCII space
// before the % where French sets U+00A0 (R91), and two decimals on every rate
// including the ones SPEC gives one or none.
//
// `formatPercent` requires its precision explicitly (R97), because a default
// once rendered the declarable rate - the figure SPEC 7.3 says must match the
// employer's filing - as 39,1 instead of 39,16. The precisions below are the
// ones that comment names.

/**
 * The rail's drawing width, in CSS pixels.
 *
 * NOT A DESIGN TOKEN and deliberately not one: it is a GEOMETRY input to a
 * pure function, the same kind of value as the 210mm sheet. The A4 content
 * column is 210mm less 28mm of gutter, which is about 688 px at 96 dpi; 640
 * leaves the rail inside the column at every printer margin we have seen.
 */
const RAIL_WIDTH = 640;

/** A day, as the document prints it. */
function day(iso: string): string {
  const [y, m, d] = iso.split('-');

  return `${d}.${m}.${y}`;
}

/** An instant, as the annex prints it - date and minute, never seconds. */
function stamp(iso: string | null): string {
  if (iso === null) return '';

  const date = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');

  return (
    `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  );
}

const KIND_LABEL: Readonly<Record<string, string>> = {
  CH: COPY.annex.kindSwiss,
  HOME: COPY.annex.kindHome,
  MISSION_FR: COPY.annex.kindMissionFrance,
  MISSION_THIRD: COPY.annex.kindMissionThird,
};

const ABSENCE_LABEL: Readonly<Record<string, string>> = {
  CONGE: COPY.annex.absenceConge,
  MALADIE: COPY.annex.absenceMaladie,
  FERIE: COPY.annex.absenceFerie,
  AUTRE: COPY.annex.absenceAutre,
};

const PORTION_LABEL: Readonly<Record<string, string>> = {
  FULL: COPY.annex.portionFull,
  AM: COPY.annex.portionMorning,
  PM: COPY.annex.portionAfternoon,
};

const PROVENANCE_LABEL: Readonly<Record<string, string>> = {
  MANUAL: COPY.annex.provenanceManual,
  DETECTED_CONFIRMED: COPY.annex.provenanceConfirmed,
  DETECTED_CORRECTED: COPY.annex.provenanceCorrected,
};

const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  const rawYear = typeof params.year === 'string' ? params.year : '';
  const rawToken = typeof params.token === 'string' ? params.token : null;

  if (!/^\d{4}$/u.test(rawYear)) notFound();

  const year = Number(rawYear);
  const grant = readPrintToken(rawToken, year);

  // A PAGE CANNOT SET A STATUS CODE THE WAY A ROUTE HANDLER CAN, so every
  // refusal here is a 404 - which is also the right answer for a document
  // somebody is not entitled to: "there is no such document for you" leaks
  // less than "there is one and you may not have it". The API export route
  // carries the distinct 401/403 codes AC3 asks for, where a caller can act
  // on them.
  if (!grant.ok) notFound();

  // DEFENCE IN DEPTH. The PDF route refuses a nameless account before it gets
  // here, but this page is also opened directly by a person, and a 500 on a
  // document that simply cannot exist is the wrong answer. Same 404 as every
  // other refusal on this route.
  let dossier;
  try {
    dossier = await buildDossierFor(grant.userId, year);
  } catch (cause) {
    if (cause instanceof MissingTitulaireError) notFound();
    throw cause;
  }
  const rules = ruleSetFor(year);
  // The RuleSet holds fractions - 0.4, 0.499 - and formatPercent takes
  // percentage points. 0 decimals for the whole one, 1 for the other: the
  // precisions the formatter's own note prescribes for threshold labels.
  // ONE object for the rail and the sentence, so the bands the reader sees
  // and the numbers the sentence states cannot come from different places.
  const thresholds = { fiscalCeiling: rules.fiscalCeiling, socialCeiling: rules.socialCeiling };
  const headroomFiscal = formatSignedDays(dossier.zone.remainingToFiscal);
  const headroomSocial = formatSignedDays(dossier.zone.remainingToSocial);
  const fiscal = formatPercent(rules.fiscalCeiling * 100, 0);
  const social = formatPercent(rules.socialCeiling * 100, 1);

  return (
    <main className={styles.sheet}>
      {/* The brand mark (mon-releve-logo kit), in black for the document and
          any black-and-white print. An <img> so the mark stays a file asset
          out of this component; decorative (alt="") because the <h1> below
          carries the document's title. */}
      <img className={styles.logo} src="/logo-black.svg" alt="" />
      <h1 className={styles.title}>{COPY.title}</h1>

      <section className={styles.identification}>
        <dl>
          {/* SPEC 12 item 1 puts the NAME first, and it is first for a reason:
              a document that cannot be attributed to a person is not a relevé,
              it is a table of numbers. `buildDossier` refuses to produce one
              without it, so this is never empty. */}
          <dt>{COPY.header.name}</dt>
          <dd>{dossier.titulaire}</dd>
          <dt>{COPY.header.canton}</dt>
          <dd>{dossier.canton}</dd>
          <dt>{COPY.header.employmentRate}</dt>
          {/* 0 decimals: a taux d'activité is whole. And the formatter, not a
              literal - it carries the U+00A0 French sets before the sign, which
              a hand-typed " %" does not. */}
          <dd>{formatPercent(dossier.employmentRate, 0)}</dd>
          <dt>{COPY.header.method}</dt>
          <dd>
            {dossier.denominatorKind === 'EXACT'
              ? COPY.header.methodExact
              : COPY.header.methodSimplified(rules.simplifiedBasisDays)}
          </dd>
          {/* SPEC 12 item 1. KEYED ON THE FRACTION THE ENGINE USED, not on
              whether a start date exists.

              This line said "Année 2026 entière" unconditionally until FW26,
              while the engine prorated the basis for anybody with an
              activityStartDate - so a person who began on 1 July read roughly
              120 jours ouvrés under a claim of the whole year. Every figure
              below was right; the line framing them was false.

              The two coincide today. Keying on the start date would be correct
              exactly as long as nothing else ever prorates, and would go stale
              in silence the day something did - which is how this happened. */}
          <dt>{COPY.header.period}</dt>
          <dd>
            {dossier.period.fraction >= 1
              ? COPY.header.fullYear(year)
              : dossier.period.startDate === null
                ? COPY.header.partialPeriod(year)
                : COPY.header.fromDate(day(dossier.period.startDate), year)}
          </dd>
          {/* SPEC 12 item 1, last. A dossier with no generation date cannot be
              placed against the year it describes - two exports of 2026 made
              six months apart are different documents and must say so. */}
          <dt>{COPY.header.generatedAt}</dt>
          <dd>{stamp(dossier.generatedAt)}</dd>
          {/* D28: absences are counted ONCE, here, and appear in no other
              figure. SPEC 12 item 5 puts the count in this block. */}
          <dt>{COPY.header.absencesDeclared}</dt>
          <dd>{formatDays(dossier.absenceDays)}</dd>
        </dl>
      </section>

      <section className={styles.tiles}>
        <div>
          <span className={styles.tileValue}>{formatDays(dossier.tiles.workedDays)}</span>
          <span className={styles.tileLabel}>{COPY.tiles.workedDays}</span>
          {/* R225: the note that answers the question this tile raises. */}
          <span className={styles.tileNote}>{COPY.tiles.workedDaysNote}</span>
        </div>
        <div>
          <span className={styles.tileValue}>{formatDays(dossier.tiles.swissDays)}</span>
          <span className={styles.tileLabel}>{COPY.tiles.swissDays}</span>
        </div>
        <div>
          <span className={styles.tileValue}>{formatDays(dossier.tiles.teleworkDays)}</span>
          <span className={styles.tileLabel}>{COPY.tiles.teleworkDays}</span>
        </div>
        <div>
          <span className={styles.tileValue}>{formatDays(dossier.tiles.missionDays)}</span>
          <span className={styles.tileLabel}>{COPY.tiles.missionDays}</span>
        </div>
      </section>

      <section className={styles.zone}>
        <p className={styles.rate}>
          {/* 2 decimals: SPEC 7.3's filed figure. */}
          <span className={styles.rateValue}>
            {formatPercent(dossier.zone.declarableRate, 2)}
          </span>
          <span className={styles.rateLabel}>{COPY.zone.declarableLabel}</span>
        </p>

        {/* SPEC 12 item 3 lists the rail as part of the zone panel, and SPEC
            line 885 justifies non-drift BY ASSERTING this route renders it:
            "because the print route renders renderRailSvg and the same
            formatters, the browser, the PDF and the OG image cannot drift".
            It did not, until FW25b - the guarantee was written down and never
            wired, which is R-a-rule-with-no-enforcement-point on a spec line.

            THE COMPONENT, NOT renderRailSvg DIRECTLY. ThresholdRail owns the
            one sanctioned dangerouslySetInnerHTML, and tests/unit/meta/
            inner-html.test.ts pins how many of those exist precisely so a
            second call site is a failing test rather than something a
            reviewer has to notice. It is a server component, so this adds no
            client JS to a page that deliberately ships none.

            POSITIONED BY declarableRate (R224): the rail and the large figure
            above it must be the same number, or the document argues with
            itself in the one place a reader looks first. */}
        <div className={styles.rail}>
          <ThresholdRail
            percentage={dossier.zone.declarableRate}
            zone={zoneFor(dossier.zone.declarableRate, thresholds)}
            thresholds={thresholds}
            // COMPACT, AND THE REASON IS MONOCHROME RATHER THAN SPACE.
            //
            // `inline` adds an HTML legend of three colour-coded dots -
            // Imposition Suisse, Imposition France, Sécurité sociale France.
            // Rendering the document in greyscale turns those into three
            // IDENTICAL grey dots beside three different labels, which is
            // worse than omitting them: it implies a distinction the reader
            // cannot make, on the one surface SPEC 12 says must survive a
            // photocopy.
            //
            // `compact` drops the legend and keeps everything that carries
            // meaning without colour - the track, both ticks WITH their
            // labels, and the rate. The component's own comment says compact
            // is "the variant chosen when there is no room"; there is room
            // here, and the criterion is that the legend says nothing in
            // black and white.
            variant="compact"
            width={RAIL_WIDTH}
          />
        </div>

        {dossier.zone.ratesDiffer ? (
          <p className={styles.rawRate}>
            {/* 1 decimal: R26's second domain, a share of days. */}
            <span>{formatPercent(dossier.zone.rawRate, 1)}</span> {COPY.zone.rawLabel}
            <span className={styles.note}>{COPY.zone.ratesDifferNote}</span>
          </p>
        ) : null}

        <p className={styles.thresholds}>{COPY.zone.thresholds(fiscal, social)}</p>

        {/* R239: HOW FAR, which is the question this product exists to answer
            and the one the rail raises without answering. Both figures were in
            the payload and both labels were written; the page used the numbers
            only to choose a badge.

            SPEC 7.2 step 6 and R12: a negative is REPORTED, not clamped - the
            label changes and the magnitude is printed unsigned, because
            "6,5 jours au-dessus" is a position and "-6,5" is a formatting
            artefact. `formatSignedDays` splits exactly that way: the text
            carries no sign and the caller picks the sentence. */}
        <dl className={styles.headroom}>
          <dt>
            {headroomFiscal.negative ? COPY.zone.overFiscal : COPY.zone.remainingToFiscal}
          </dt>
          <dd>{headroomFiscal.text}</dd>
          <dt>
            {headroomSocial.negative ? COPY.zone.overSocial : COPY.zone.remainingToSocial}
          </dt>
          <dd>{headroomSocial.text}</dd>
        </dl>

        {/* THE BADGE IS A WORD. SPEC 12: every status carries its word, and
            each names WHICH seuil - two badges both reading "dépassé" tell a
            photocopied reader nothing. */}
        <p className={styles.badge}>
          {dossier.zone.remainingToFiscal < 0
            ? COPY.zone.badgeOverFiscal
            : dossier.zone.remainingToSocial < 0
              ? COPY.zone.badgeOverSocial
              : COPY.zone.badgeUnder}
        </p>

        {dossier.zone.remainingToFiscal < 0 ? (
          <p className={styles.note}>{COPY.zone.overFiscalNote}</p>
        ) : null}
      </section>

      <section className={styles.months}>
        <h2>{COPY.months.caption}</h2>
        <table>
          <thead>
            <tr>
              <th>{COPY.months.month}</th>
              <th>{COPY.months.swiss}</th>
              <th>{COPY.months.home}</th>
              <th>{COPY.months.missionFrance}</th>
              <th>{COPY.months.missionThird}</th>
              <th>{COPY.months.cumulative}</th>
            </tr>
          </thead>
          <tbody>
            {dossier.months.map((month) => (
              <tr key={month.month}>
                <td>{MONTHS[month.month - 1]}</td>
                <td>{formatDays(month.swissDays)}</td>
                <td>{formatDays(month.teleworkDays)}</td>
                <td>{formatDays(month.missionDaysFrance)}</td>
                <td>{formatDays(month.missionDaysThirdState)}</td>
                <td>{formatPercent(month.cumulativeDeclarableRate, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.note}>{COPY.months.cumulativeNote}</p>
      </section>

      <section className={styles.annex}>
        {/* TWO ELEMENTS RATHER THAN ONE WITH AN EM DASH BETWEEN THEM. The
            dash was a literal in JSX, which react/jsx-no-literals refuses for
            the same reason it refuses a French word: punctuation between two
            copy strings is copy, and it belongs in lib/fr or nowhere. */}
        <h2>{COPY.annex.heading}</h2>
        <p className={styles.subheading}>{COPY.annex.subheading}</p>
        <table>
          <thead>
            <tr>
              <th>{COPY.annex.dayDate}</th>
              <th>{COPY.annex.portion}</th>
              <th>{COPY.annex.kind}</th>
              <th>{COPY.annex.note}</th>
              <th>{COPY.annex.provenance}</th>
              <th>{COPY.annex.firstRecordedAt}</th>
              <th>{COPY.annex.lastModifiedAt}</th>
              <th>{COPY.annex.clientClaimedAt}</th>
            </tr>
          </thead>
          <tbody>
            {dossier.annex.map((entry) =>
              entry.recorded ? (
                <tr key={`${entry.dayDate}-${entry.portion ?? ''}`}>
                  <td>{day(entry.dayDate)}</td>
                  <td>{PORTION_LABEL[entry.portion ?? ''] ?? entry.portion}</td>
                  <td>
                    {entry.kind === 'ABSENT'
                      ? (ABSENCE_LABEL[entry.absenceReason ?? 'AUTRE'] ?? COPY.annex.absenceAutre)
                      : (KIND_LABEL[entry.kind ?? ''] ?? entry.kind)}
                    {entry.late ? <span className={styles.late}> {COPY.annex.late}</span> : null}
                  </td>
                  <td>{entry.note ?? ''}</td>
                  <td>{PROVENANCE_LABEL[entry.provenance ?? ''] ?? entry.provenance}</td>
                  <td>{stamp(entry.firstRecordedAt)}</td>
                  <td>{stamp(entry.lastModifiedAt)}</td>
                  <td>{stamp(entry.clientClaimedAt)}</td>
                </tr>
              ) : (
                // SPEC 12 item 5: a working day nobody logged is PRINTED, not
                // skipped. One spanning cell rather than six empty ones,
                // because a row of blanks reads as data that failed to load -
                // which is the ambiguity the requirement exists to remove.
                <tr key={entry.dayDate} className={styles.notRecorded}>
                  <td>{day(entry.dayDate)}</td>
                  <td colSpan={7}>{COPY.annex.notRecorded}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        <p className={styles.note}>{COPY.annex.lateNote}</p>
        <p className={styles.note}>{COPY.annex.offlineNote}</p>
      </section>

      {/* R183: UNCONDITIONAL. The site footer branches on trackerExists
          because there the clause is a claim about a product state; here every
          entry in the document IS timestamped, or it would not be here. */}
      <footer className={styles.legal}>
        <p>{COPY.footer.timestamps}</p>
        <p>{COPY.footer.declaration}</p>
        <p>{COPY.footer.notAdvice}</p>
      </footer>
    </main>
  );
}
