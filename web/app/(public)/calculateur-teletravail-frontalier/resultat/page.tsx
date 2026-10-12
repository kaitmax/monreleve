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
import { CALCULATOR_PATH } from '@/lib/content/routes';
import { currentTaxYear } from '@/lib/content/tax-year';
import { decode } from '@/lib/params/codec';
import { encode } from '@/lib/params/codec';
import { FORM_ONLY_PARAMS, strayParams } from '@/lib/params/schema';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { errorMessage } from '@/lib/fr/errors';
import { PARAM_NOTICE } from '@/lib/fr/params';
import { Container } from '@/lib/ui/react/Container/Container';
import { ResultPanel } from '../ResultPanel';
import styles from './resultat.module.scss';

const COPY = CALCULATEUR_COPY.resultat;

/**
 * NO CANONICAL AND NO OG CARD, and that is this route's whole licence to read
 * the URL. The layout adds them only when a real origin is configured (R81);
 * here they would point at a page that must not be indexed in the first place.
 * robots is stated in the metadata as well as in middleware's header: the
 * header is the instruction a crawler obeys, and this makes the page's own
 * intent readable to somebody looking at the source.
 */
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
    if (typeof value === 'string') query.set(name, value);
    else if (Array.isArray(value) && typeof value[0] === 'string') query.set(name, value[0]);
  }

  const decoded = decode(query, year);
  const outcome = decoded.input === null ? null : calculateTelework(decoded.input);

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
      : encode(decoded.input).toString();
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
            {/* The island's own panel, with the island's own arguments. */}
            <ResultPanel result={outcome.value} thresholds={rules} />
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
