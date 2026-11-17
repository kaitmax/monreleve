// web/app/(public)/calculateur-teletravail-frontalier/resultat/page.tsx
//
// RULING R351: the calculator's answer, rendered by the SERVER from the URL.
//
// ============================================================================
// WHY THIS PAGE EXISTS AND THE CALCULATOR DOES NOT ANSWER FOR ITSELF
// ============================================================================
//
// SPEC 9.3 asks the calculator PAGE to be meaningful without JavaScript, and
// it is: every explanatory paragraph is served. It does not calculate, and
// that was never hidden - FW13 recorded the trade in the calculator page's own
// header. Measured on a production build of main before this route existed:
// `?canton=GE&tt=84&mfr=24&decompte=dj` returns 200, carries no figure, and
// shows the same empty state as the bare path.
//
// THE CALCULATOR CANNOT BE THE ONE TO FIX THAT. FW13 increment 2 built five
// shapes and measured them: ANY use of searchParams on that route - page,
// generateMetadata, or a Suspense child - makes it dynamic and emits <title>
// and <link rel="canonical"> into the BODY. It is SPEC 14's target-query page,
// so a canonical a non-rendering crawler cannot see is not a trade worth
// making, and AC3's noindex would land in the body too, where it is ignored.
//
// So the answer moved instead of the calculator changing. This route is
// allowed to be dynamic because it has nothing to protect: no canonical worth
// having, no place in the sitemap, and a noindex that arrives as a header.
//
// ============================================================================
// IT COMPUTES NOTHING ITSELF
// ============================================================================
//
// decode() is SPEC 9.4's codec, the same pure function the island calls on
// mount. calculateTelework() is the same engine entry. ResultPanel is the same
// component, rendering the same figures in SPEC 9.3's order. A reader with
// scripting and a reader without are answered by one implementation (R206) -
// the only difference is which machine ran it.
//
// THAT IS ALSO WHY THERE IS NO ARITHMETIC HERE. R340's rule and FW12's defect:
// a figure a component computed is a second engine nobody tested.

import type { Metadata } from 'next';
import { calculateTelework, ruleSetFor } from '@/lib/calc-engine';
import { CALCULATOR_PATH, liveHrefs } from '@/lib/content/routes';
import { currentDayInParis, currentTaxYear } from '@/lib/content/tax-year';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { project } from '@/lib/forecast/project';
import { formatDate, formatPercent } from '@/lib/ui/core';
import { Projection } from './Projection';
import { decode } from '@/lib/params/codec';
import { encode } from '@/lib/params/codec';
import { FORM_ONLY_PARAMS, strayParams } from '@/lib/params/schema';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { errorMessage } from '@/lib/fr/errors';
import { PARAM_NOTICE } from '@/lib/fr/params';
import { RESULT_COPY } from '@/lib/fr/result';
import { Container } from '@/lib/ui/react/Container/Container';
import { AppCard } from '../AppCard';
import { ResultPanel } from '../ResultPanel';
import styles from './resultat.module.scss';

const COPY = CALCULATEUR_COPY.resultat;

/**
 * A ceiling as the tiles name it.
 *
 * THE SAME SHAPE ResultPanel USES, and for the same reason: 40 % reads as
 * "40 %" and 49,9 % as "49,9 %", so the decimal count follows the value
 * rather than being fixed. Duplicated rather than imported because
 * ResultPanel keeps it private; noted here so the next reader knows the
 * two exist (R206 would prefer one home, and this is the smaller evil
 * than widening that component's exports for a four-line helper).
 */
const ceiling = (rate: number): string => {
  const percent = rate * 100;

  return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
};

/**
 * NO CANONICAL AND NO OG CARD, and that is this route's whole licence to read
 * the URL. The layout adds them only when a real origin is configured (R81);
 * here they would point at a page that must not be indexed in the first place.
 * robots is stated in the metadata as well as in middleware's header: the
 * header is the instruction a crawler obeys, and this makes the page's own
 * intent readable to somebody looking at the source.
 */
/**
 * NEVER FROM A CACHE, BECAUSE THE ANSWER DEPENDS ON WHAT DAY IT IS.
 *
 * The projection counts the working days from tomorrow to 31 December, so
 * a response cached on 9 October and served on 10 November is wrong by a
 * month - and wrong in the direction that flatters, since it imagines days
 * that have since passed unrecorded. Awaiting searchParams already makes
 * this route dynamic; stating it as well means the guarantee survives a
 * future edit that stops reading them.
 *
 * IT COSTS THIS ROUTE NOTHING. force-dynamic broke the CALCULATOR when
 * FW13 measured it - a streamed route emits <title> and canonical into the
 * body - and this page has neither to protect: it is noindex on every URL
 * and absent from the sitemap.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: COPY.title,
  description: COPY.description,
  robots: { index: false, follow: true },
  alternates: {},
};

/**
 * Next 15 hands searchParams as a promise, and awaiting it is what makes this
 * route dynamic - which is exactly what the calculator must never be.
 */
export default async function ResultatPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | readonly string[] | undefined>>;
}) {
  const year = currentTaxYear();
  const rules = ruleSetFor(year);
  const params = await searchParams;

  // Rebuilt as URLSearchParams rather than read field by field: decode() owns
  // the vocabulary, and a second reader of these names would be a second
  // schema (R206). A repeated param keeps its first value, which is what the
  // codec's own tests pin.
  const query = new URLSearchParams();

  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      query.set(name, value);
      continue;
    }

    // EVERY VALUE, NOT THE FIRST. This kept value[0] until FW-FORECAST, and
    // it was correct while every param was single-valued. `rythme` repeats -
    // five checkboxes share one name - so taking the first collapsed a
    // two-day rhythm to one day and projected from it, silently: the page
    // still rendered a projection, still rendered a plausible percentage,
    // and the figure was wrong. Found by driving the journey (R176), not by
    // a test - the e2e assertion said "a rate appears", which it did.
    if (Array.isArray(value)) {
      for (const entry of value) if (typeof entry === 'string') query.append(name, entry);
    }
  }

  const decoded = decode(query, year);

  // R28: the day in Europe/Paris, resolved on the server and passed down.
  // A clock inside the projection would read the host zone, and a host in
  // UTC at 23:30 is already tomorrow in Paris - a whole working day of
  // projection, wrong every evening.
  const today = currentDayInParis();
  const outcome = decoded.input === null ? null : calculateTelework(decoded.input);

  // ONCE, NOT PER USE. project() runs the engine twice, and calling it
  // again inside the JSX would run it four times to render one block -
  // and would make the null check and the render two separate opinions
  // about whether there is a projection.
  const projection =
    decoded.input === null ? null : project(decoded.input, decoded.rhythm, today);

  // THE CALCULATOR’S OWN CONTROLS ARE NOT STRAY PARAMS. decode() is right
  // to report `missions`: the engine does not read it. The NOTICE would be
  // wrong to print it, because its sentence is about a tracking parameter
  // somebody else appended - see FORM_ONLY_PARAMS.
  const stray = strayParams(decoded.ignored);

  /*
    DECLARED MISSIONS THAT NOBODY COULD COUNT.

    With no scripting the two count fields are never revealed, so a reader
    who answers "oui" submits the question and no numbers - and the engine
    computes from zero mission days. SPEC 9.3 puts that question outside
    the accordion exactly so a user with missions does not get a silently
    wrong answer, and silence is what this page would otherwise give them.

    CONDITIONAL ON THE CONDITION (R225): only when the answer was yes AND
    no days arrived. A note that always rendered would be noise on the
    result of somebody who filled both fields in.
  */
  const declaredMissions = query.get('missions') === CALCULATEUR_COPY.form.missions.yes;
  const missionDays =
    decoded.input === null
      ? 0
      : decoded.input.missionDaysFrance + decoded.input.missionDaysThirdState;
  // ON A REAL ANSWER ONLY. Without this the note renders above "cette
  // adresse ne contient aucun chiffre a calculer" - a sentence about a
  // calculation that did not happen. R225’s condition is that the RESULT
  // raises the question, and with no result there is no question.
  const missionsUncounted =
    declaredMissions && missionDays === 0 && outcome?.ok === true;
  /*
    THE WAY BACK, AND IT IS REBUILT RATHER THAN ECHOED.

    Handing the raw query back would carry the form’s own controls with
    it - `missions=Non` above all - and the island decodes whatever it
    finds on mount, so the reader would arrive at the calculator and be
    told "ces parametres ne sont pas utilises par le calculateur :
    missions" about the question they had just answered.

    encode() WHERE THERE IS AN INPUT, because that is the same function
    the share row uses and it emits exactly SPEC 9.4’s params with the
    defaults omitted - so the link a reader follows back has the same
    shape as the link they would have shared. Where the input could not
    be built there is nothing to encode, so the raw query goes back with
    the form-only names removed.
  */
  const backQuery =
    decoded.input === null
      ? (() => {
          const kept = new URLSearchParams(query);

          for (const name of FORM_ONLY_PARAMS) kept.delete(name);

          return kept.toString();
        })()
      : // THE RHYTHM GOES BACK TOO, AND THE WALKTHROUGH IS WHY (R343).
        //
        // This read encode(decoded.input) until FW-FORECAST, which was
        // complete when the only thing a link carried was an engine
        // scenario. It silently dropped the rhythm: following "Modifier
        // mes chiffres" landed the reader on a calculator with every box
        // unchecked and their projection gone, having touched nothing.
        encode(decoded.input, decoded.rhythm).toString();
  const back = backQuery === '' ? CALCULATOR_PATH : `${CALCULATOR_PATH}?${backQuery}`;

  return (
    <main className={styles.page}>
      <Container width="narrow">
        {/*
          THE HEADING STATES WHAT IS BELOW IT, AND THE WALKTHROUGH IS WHY THIS
          IS A BRANCH.

          It read COPY.heading unconditionally, and driving the page with
          scripting off produced two pages that argue with themselves:

            "Votre part de teletravail / Cette adresse ne contient aucun
             chiffre a calculer"
            "Votre part de teletravail / Ces chiffres ne permettent pas un
             calcul"

          Each half was correct and the pair was not - exactly what R176 says
          a walkthrough catches and a baseline cannot, because a baseline
          would have photographed both and certified them.

          COPY.title RATHER THAN A FOURTH STRING. It is this page’s name, it
          is already the <title>, and a heading that matches the tab is what a
          reader expects. Writing a second constant with the same words would
          be two homes for one text (R206).
        */}
        <h1 className={styles.title}>{outcome?.ok === true ? COPY.heading : COPY.title}</h1>

        {/*
          THE LINK NOTICE, SPEC 9.4, AND THE REASON IT IS HERE AT ALL.

          decode() reports two things besides the input: values it could
          not read and params it does not know. A page that branched only
          on `input === null` would render a figure over a silently
          dropped value - which is R351’s own premise one route over,
          and measured rather than imagined: a browser submits EVERY named
          control, so `taux=`, `total=` and `debut=` each arrive empty and
          each come back `invalid`, and `decompte=halfDay` falls back to
          `day` and computes a different answer without a word.

          ABOVE THE RESULT, for the island’s own reason: a reader who
          does not know a value was dropped has no reason to doubt the
          numbers, and those numbers are a correct answer to the wrong
          scenario.

          THREE OF ITS FOUR SENTENCES COME FROM PARAM_NOTICE and the
          fourth from this page (R206, R165) - see lib/fr/calculateur.ts.

          NO DISMISS CONTROL, UNLIKE THE CALCULATOR’S. SPEC 9.4 asks for a
          dismissible notice; dismissing is a state change and this page
          runs no script, so the control would be a button that does
          nothing - worse than no control. The requirement is discharged
          on the calculator, which is the surface SPEC 9.4 names, and the
          notice here is three lines above a result it blocks nothing of.
          Recorded as an interpretation in REPORT-FW-RESULTAT.txt.
        */}
        {decoded.invalid.length === 0 && stray.length === 0 ? null : (
          <div className={styles.notice} data-notice="params">
            <p className={styles.noticeLead}>{PARAM_NOTICE.lead}</p>
            {decoded.invalid.length === 0 ? null : (
              <p className={styles.noticeBody}>{PARAM_NOTICE.invalid(decoded.invalid)}</p>
            )}
            {stray.length === 0 ? null : (
              <p className={styles.noticeBody}>{PARAM_NOTICE.ignored(stray)}</p>
            )}
            <p className={styles.noticeBody}>{COPY.noticeAdvice}</p>
          </div>
        )}

        {!missionsUncounted ? null : (
          <p className={styles.notice} data-notice="missions">
            {COPY.missionsNotCounted}
          </p>
        )}

        {outcome === null ? (
          <>
            <p className={styles.state}>{COPY.empty}</p>
            <p className={styles.actions}>
              <a href={CALCULATOR_PATH}>{COPY.open}</a>
            </p>
          </>
        ) : outcome.ok ? (
          <>
            {/*
              R727: THE SAME RESULT COLUMN the calculator draws - the
              island's own panel, with the island's own arguments, then the
              projection, then the application card - so a reader without
              JavaScript sees the same result card.
            */}
            <div className={styles.column}>
            <ResultPanel
              result={outcome.value}
              thresholds={rules}
              liveLinks={liveHrefs(RESULT_COPY.links)}
            />

            {/*
              THE PROJECTION, when a rhythm arrived (R343, FW-FORECAST).
              project() returns null for an empty rhythm, so a reader who
              did not answer the question sees exactly what they saw
              before it existed.
            */}
            {projection === null ? null : (
              <Projection
                appReleased={PRODUCT_STATE.appExists}
                day={formatDate(today.toISOString().slice(0, 10))}
                fiscal={ceiling(rules.fiscalCeiling)}
                projection={projection}
                social={ceiling(rules.socialCeiling)}
                thresholds={rules}
              />
            )}
            <AppCard />
            </div>
            <p className={styles.actions}>
              {/* Carrying the query, so a scripted reader lands on the
                  calculator with their scenario already decoded - which is
                  the interactive calculator, reached from a static answer. */}
              <a href={back}>{COPY.modify}</a>
            </p>
          </>
        ) : (
          <>
            <p className={styles.state}>{COPY.invalid}</p>
            {/* THE ENGINE'S REASONS, NOT THIS PAGE'S. errorMessage is the same
                mapping the form uses, so a refusal reads identically whether
                it was met in the island or here. */}
            <ul className={styles.errors}>
              {/* Keyed by the CODE, not by a field: ValidationError is a
                  union and some variants carry no field at all, which is a
                  compile error worth having rather than a key that reads
                  "undefined:RATE_OUT_OF_RANGE". The engine emits each code at
                  most once per call, so the code is unique here. */}
              {outcome.error.map((error) => (
                <li key={error.code}>{errorMessage(error)}</li>
              ))}
            </ul>
            <p className={styles.actions}>
              <a href={back}>{COPY.modify}</a>
            </p>
          </>
        )}
      </Container>
    </main>
  );
}
