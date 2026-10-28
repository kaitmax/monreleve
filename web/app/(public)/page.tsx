// web/app/(public)/page.tsx
//
// THE HOME PAGE, A2: "the releve first, then the counter" (FW-HOME-A2, rulings
// R709-R723), built from the operator's approved design canvas
// (docs/design/home-a2.dc.html). The canvas is a REFERENCE, not code: its
// inline styles, holes and script are not copied here. What is binding is its
// section order, each section's content and structure, its copy and its
// colour roles (R709); its fonts and pill shapes are not - this page uses
// DESIGN-SYSTEM's Inter and its radius and type tokens.
//
// IT RENDERS INSIDE THE PUBLIC SHELL, which supplies sections 1 and 9 - the
// header and the footer - unchanged. The canvas draws its own header and
// footer; they are the shell's on every other page, so this page does not
// redraw them (R709, recorded in the report). The sections here, in the
// canvas's order:
//
//   2  the opening, with the releve excerpt beside it   (R714)
//   3  the counter - the page's ONLY client island      (R711)
//   4  the application, two phones                      (R716)
//   5  the two thresholds, on brand                     (R715)
//   6  the year in three cards
//   7  the alert sign-up - the real AlertCapture        (R718)
//   8  the questions                                    (R717)
//
// THE FIGURES COME FROM THE ENGINE AND THE RULESET, NEVER TYPED (R147, R710).
// The thresholds arrive through guideScope; the counter through
// calculateTelework (lib/content/home-counter.ts); the phones' rate through
// calculateTelework over lib/content/home.ts's worked example.
//
// EVERY LINK GOES SOMEWHERE THAT ANSWERS (R713). The canvas's "Se connecter"
// and "Voir un relevé d'exemple" are not rendered: there is no web account and
// no sample releve to show (both parked). The application actions go to
// /application, with words PRODUCT_STATE chooses; no store link exists until a
// store listing does. e2e/home.spec.ts walks every internal link on the page.

import type { Metadata } from 'next';
import { calculateTelework } from '@/lib/calc-engine';
import { heroExampleInput } from '@/lib/content/home';
import { COUNTER_CANTON } from '@/lib/content/home-counter';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { CALCULATOR_PATH, RESULT_PATH } from '@/lib/content/routes';
import { currentTaxYear } from '@/lib/content/tax-year';
import { CANTONS_BY_NAME } from '@/lib/fr/cantons';
import { HOME_COPY } from '@/lib/fr/home';
import { METRIC_COPY } from '@/lib/fr/metrics';
import { SHELL_COPY } from '@/lib/fr/shell';
import { SOURCE_CITATIONS } from '@/lib/fr/sources';
import { guideScope } from '@/lib/guides/scope';
import { PARAM_SCHEMA, methodCode, type ParamName } from '@/lib/params/schema';
import { AlertCapture } from '@/lib/ui/react/AlertCapture/AlertCapture';
import { Container } from '@/lib/ui/react/Container/Container';
import { Faq } from '@/lib/ui/react/Faq/Faq';
import { HeroPhone } from '@/lib/ui/react/HeroPhone/HeroPhone';
import { HomeCounter } from '@/lib/ui/react/HomeCounter/HomeCounter';
import { ReleveExcerpt } from '@/lib/ui/react/ReleveExcerpt/ReleveExcerpt';
import styles from './home.module.scss';

/**
 * Where the application actions go. The shell's own "Suivre mes jours" holds
 * this address; one home for it (R206), and it is the existing /application
 * page rather than a store (R713).
 */
const APPLICATION_PATH = SHELL_COPY.ctaHref;

/**
 * The calculator parameter that carries an engine field, read from SPEC 9.4's
 * schema rather than typed (R206): the counter's sliders are named after the
 * parameters the result page already decodes, and a renamed parameter moves
 * them with it.
 */
function paramFor(field: string): ParamName {
  const entry = Object.entries(PARAM_SCHEMA).find(([, spec]) => spec.field === field);

  if (entry === undefined) throw new Error(`no calculator parameter carries ${field}`);

  return entry[0] as ParamName;
}

/** The counter's GET form, for a reader with no JavaScript (R346, R351). */
const COUNTER_FORM = {
  action: RESULT_PATH,
  teleworkName: paramFor('teleworkDays'),
  basisName: paramFor('denominator.totalWorkDays'),
  hidden: [[paramFor('denominator.kind'), methodCode('exact')]] as const,
};

/** The canton the no-script choice opens on - the counter's own (GE). */
const NOSCRIPT_CANTON = COUNTER_CANTON;

// generateMetadata RATHER THAN A CONSTANT, because R147 reaches lib/fr: the
// description names both thresholds and types neither. UNCHANGED BY A2 (R721):
// the description still says what the page does - the calculation and the
// days before each threshold - and the new hero makes none of it false.
export function generateMetadata(): Metadata {
  const { fiscal, social } = guideScope(currentTaxYear());

  return { description: HOME_COPY.description(fiscal, social, PRODUCT_STATE) };
}

export default function HomePage() {
  const year = currentTaxYear();
  const scope = guideScope(year);
  const example = calculateTelework(heroExampleInput(year));
  const C = HOME_COPY;

  return (
    <main>
      {/* ------------------------------------------------- 2. THE OPENING */}
      <section className={styles.opening}>
        <Container width="public">
          <div className={styles.openingGrid}>
            <div className={styles.openingText}>
              <p className={styles.line}>{C.opening.line}</p>
              <h1 className={styles.heading}>{C.opening.heading}</h1>
              <p className={styles.lead}>
                {C.opening.lead(scope.fiscal, scope.social, PRODUCT_STATE)}
              </p>
              <div className={styles.actions}>
                <a className={styles.buttonPrimary} href="#calcul">
                  {C.opening.cta}
                </a>
              </div>
              <p className={styles.small}>{C.opening.free}</p>
            </div>

            <ReleveExcerpt state={PRODUCT_STATE} />
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------- 3. THE COUNTER */}
      <section id="calcul" className={styles.counter} aria-labelledby="calcul-titre">
        <Container width="public">
          <h2 className={styles.sectionHeading} id="calcul-titre">
            {C.counter.heading}
          </h2>
          <p className={styles.sectionIntro}>{C.counter.intro}</p>

          <div className={styles.counterCard}>
            <HomeCounter
              taxYear={year}
              copy={{
                rateLabel: C.counter.rateLabel,
                status: C.counter.status,
                fiscalTile: C.counter.tile(METRIC_COPY.remaining(scope.fiscal), C.counter.fiscalRule),
                fiscalOver: C.counter.tile(METRIC_COPY.over(scope.fiscal), C.counter.fiscalRule),
                socialTile: C.counter.tile(METRIC_COPY.remaining(scope.social), C.counter.socialRule),
                socialOver: C.counter.tile(METRIC_COPY.over(scope.social), C.counter.socialRule),
                teleworkLabel: C.counter.teleworkLabel,
                basisLabel: C.counter.basisLabel,
              }}
              form={COUNTER_FORM}
            >
              {/* Only with scripting off: the result page needs a canton,
                  and something has to submit the sliders (R346, R351). */}
              <noscript>
                <div className={styles.noscript}>
                  <label className={styles.noscriptLabel} htmlFor="home-canton">
                    {C.counter.noscriptCanton}
                  </label>
                  <select
                    className={styles.noscriptSelect}
                    defaultValue={NOSCRIPT_CANTON}
                    id="home-canton"
                    name={paramFor('canton')}
                  >
                    {CANTONS_BY_NAME.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button className={styles.buttonPrimary} type="submit">
                    {C.counter.noscriptSubmit}
                  </button>
                </div>
              </noscript>
            </HomeCounter>

            <p className={styles.small}>{C.counter.note}</p>

            <div className={styles.actions}>
              <a className={styles.buttonPrimary} href={CALCULATOR_PATH}>
                {C.counter.full}
              </a>
              <a className={styles.buttonSecondary} href={APPLICATION_PATH}>
                {C.counter.app(PRODUCT_STATE)}
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* --------------------------------------------- 4. THE APPLICATION */}
      <section className={styles.application}>
        <Container width="public">
          <div className={styles.applicationGrid}>
            <div className={styles.applicationText}>
              <h2 className={styles.sectionHeading}>{C.mobile.heading}</h2>
              <p className={styles.body}>{C.mobile.body(PRODUCT_STATE)}</p>
              <p className={styles.body}>{C.mobile.availability(PRODUCT_STATE)}</p>
              <div className={styles.actions}>
                <a className={styles.buttonPrimary} href={APPLICATION_PATH}>
                  {C.mobile.cta(PRODUCT_STATE)}
                </a>
              </div>
            </div>

            {example.ok ? (
              <div className={styles.phones}>
                <HeroPhone
                  platform="android"
                  result={example.value}
                  taxYear={year}
                  fiscal={scope.fiscal}
                />
                <HeroPhone
                  platform="iphone"
                  result={example.value}
                  taxYear={year}
                  fiscal={scope.fiscal}
                />
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {/* --------------------------------------------- 5. TWO THRESHOLDS */}
      <section className={styles.band}>
        <Container width="public">
          <div className={styles.bandGrid}>
            <h2 className={styles.bandHeading}>{C.thresholds.heading}</h2>

            <div className={styles.bandRules}>
              <article className={styles.bandRule}>
                <p className={styles.bandFigure}>{scope.fiscal}</p>
                <h3 className={styles.bandTitle}>{C.thresholds.fiscalTitle}</h3>
                <p className={styles.bandBody}>
                  {C.thresholds.fiscalBody(scope.fiscal, scope.missionCap)}
                </p>
                <p className={styles.bandSource}>
                  {C.thresholds.source(SOURCE_CITATIONS.fiscal)}
                </p>
              </article>

              <article className={styles.bandRule}>
                <p className={styles.bandFigure}>{scope.social}</p>
                <h3 className={styles.bandTitle}>{C.thresholds.socialTitle}</h3>
                <p className={styles.bandBody}>{C.thresholds.socialBody(scope.social)}</p>
                <p className={styles.bandSource}>
                  {C.thresholds.source(SOURCE_CITATIONS.social)}
                </p>
              </article>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------- 6 AND 7. THE YEAR, THE ALERTS */}
      <section className={styles.year}>
        <Container width="public">
          <h2 className={styles.sectionHeading}>{C.year.heading}</h2>

          <div className={styles.cards}>
            {C.year.cards(PRODUCT_STATE).map((card) => (
              <article className={styles.card} key={card.title}>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardBody}>{card.body}</p>
              </article>
            ))}
          </div>

          {/* R718: the real sign-up, posting where it posts today. The
              'alertes' source returns the reader to /alertes, where the
              statuses are shown; a home source would be an API change. */}
          <div className={styles.alert}>
            <AlertCapture source="alertes" />
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------ 8. THE QUESTIONS */}
      <section className={styles.questions}>
        <Container width="public">
          <Faq
            heading={C.questions.heading}
            layout="split"
            entries={[
              {
                id: 'ce-que-ca-change',
                question: C.questions.change.question,
                answer: `${C.questions.change.beforeBody} ${C.questions.change.afterBody}`,
                open: true,
                pair: {
                  before: { label: C.questions.change.before, body: C.questions.change.beforeBody },
                  after: { label: C.questions.change.after, body: C.questions.change.afterBody },
                },
              },
              {
                id: 'fiduciaire',
                question: C.questions.fiduciary.question,
                answer: C.questions.fiduciary.answer(PRODUCT_STATE),
              },
              {
                id: 'position',
                question: C.questions.position.question,
                answer: C.questions.position.answer,
              },
              {
                id: 'telephone',
                question: C.questions.phone.question,
                answer: C.questions.phone.answer(PRODUCT_STATE),
              },
            ]}
          />
        </Container>
      </section>
    </main>
  );
}
