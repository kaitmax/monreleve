// web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.tsx
//
// The client island. One useState, no form library, no schema library: the
// engine's validation IS the validation (standing protocol 5), and its Result
// feeds FieldGroup.
//
// WHY THE STATE IS NOT A TeleworkInput, although the prompt describes it as
// one. Several of its fields cannot hold what a half-typed form contains:
//
//   canton         has no sane default and no empty member. TeleworkInput
//                  requires a Canton, so there is no value to put there
//                  before the user chooses - and inventing one would compute
//                  a regime for a canton nobody selected.
//   the numbers    are TEXT while being typed. An empty field is not 0: if
//                  clearing the day count silently became zero, the form
//                  would answer a question the user was in the middle of
//                  un-asking. Number('') IS 0, which is exactly that bug.
//   periodFraction is not a thing a person knows about themselves. The user
//                  gives a DATE; remainingYearFraction converts it.
//
// So the state holds what the CONTROLS hold, and buildInput turns it into a
// TeleworkInput when it can.
//
// VALIDATION GOES THROUGH calculateTelework. validateInput is internal to the
// engine and exporting it would be a change to the engine's public API, which
// SPEC 20 makes an ask-first item; the report asks. The consequence is that
// nothing is validated until a canton exists, because that is what it takes to
// build an input at all.
//
// EVERY ERROR HAS SOMEWHERE TO GO, including one whose field is hidden. See
// errorFor and `unplaced` at the bottom: a start date in the wrong year is
// reported by the engine, and if the user then collapses the accordion the
// message would simply vanish. That is not a hypothetical - it is the first
// thing that happens if the routing only looks at the code.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import {
  type Canton,
  type DenominatorMethod,
  type Granularity,
  type TeleworkInput,
  type TeleworkResult,
  type ValidationError,
  calculateTelework,
  ruleSetFor,
} from '@/lib/calc-engine';
import { provisionalFor, readingAnchor } from '@/lib/content/provisional';
import { decode, isoDayForFraction } from '@/lib/params/codec';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { PARAM_NOTICE } from '@/lib/fr/params';
import { PROVISIONAL_COPY } from '@/lib/fr/provisional';
import { CANTONS_BY_NAME } from '@/lib/fr/cantons';
import { errorMessage } from '@/lib/fr/errors';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import { formatDays, formatPercent, remainingYearFraction } from '@/lib/ui/core';
import { ResultPanel } from './ResultPanel';
import styles from './CalculatorForm.module.scss';

const COPY = CALCULATEUR_COPY.form;
const RESULT = CALCULATEUR_COPY.result;

/** The live region's id. The Calculer button moves focus here. */
const RESULT_ID = 'resultat';
const RESULT_TITLE_ID = 'resultat-titre';

const ICON = 20;
const STROKE = 1.75;

/**
 * The control bounds, matching SPEC 9.3's table.
 *
 * The rate's minimum is 1 rather than 0 because that is the range the engine
 * accepts (RATE_OUT_OF_RANGE below 1): a contract at nothing per cent is not
 * a contract. The day fields have no maximum here on purpose - the real
 * ceiling is the annual basis, which depends on the rate, the method and the
 * period, and the engine reports DAYS_EXCEED_TOTAL when it is passed. A
 * hand-typed max would be one more place the basis lives.
 */
const RATE = { step: 5, min: 1, max: 100 } as const;
const DAYS = { step: 0.5, min: 0 } as const;

/**
 * THE PUBLIC FORM COUNTS IN HALF-DAYS, and this is the increment's one real
 * interpretation.
 *
 * SPEC 9.3 puts step 0.5 on the visible day field. The engine rejects a
 * half-day value declared under granularity 'day' with GRANULARITY_MISMATCH.
 * Both cannot hold, so the default granularity for the public form is
 * 'halfDay' - the prompt reaches the same conclusion and asks for it to be
 * stated. 'day' remains available in the accordion, where choosing it makes
 * 0,5 an error, correctly.
 */
const DEFAULT_GRANULARITY: Granularity = 'halfDay';

/**
 * A decimal comma. RULING R109, which settled FW11's Q11.
 *
 * A French user writes "83,5". type="number" treats a comma as invalid, so
 * the value arrived here as the EMPTY STRING and the digits appeared to
 * vanish as they were typed - the calculator looking broken to exactly the
 * audience it is for. Reproduced in jsdom before the fix: the field read the
 * empty string after typing "83,5".
 *
 * R109: type="text" with inputMode="decimal", both separators accepted,
 * normalised to the period INTERNALLY ONLY. SPEC 9.3 corrected under R9.
 *
 * "Internally only" is the part a naive fix gets wrong. Rewriting the comma
 * to a period in state would move the caret and fight the user mid-number, so
 * the field shows what was typed and the period exists only in the value
 * handed to the engine.
 */
function parseNumeric(raw: string): number {
  const trimmed = raw.trim();

  if (trimmed === '') return Number.NaN;

  return Number(trimmed.replace(',', '.'));
}

/**
 * The start date as a fraction of the year, or the whole year.
 *
 * remainingYearFraction THROWS on anything that is not a real ISO day (R28),
 * and a date input hands over partial values while being edited - both jsdom
 * and every browser sanitise an incomplete date to the empty string, but an
 * exception reaching render would take the island down rather than show a
 * message. An unparseable value therefore means "no date given", which is
 * what an empty field means anyway.
 *
 * A date in a LATER year comes back as 0 from the conversion, which is
 * outside SPEC 7.4's range, so the engine reports PERIOD_OUT_OF_RANGE. The
 * form deliberately holds no second opinion about what a valid period is.
 */
function fractionFor(startDay: string, taxYear: number): number {
  if (startDay === '') return 1;

  try {
    return remainingYearFraction(startDay, taxYear);
  } catch {
    return 1;
  }
}

/** Every field that can carry an error message. */
type FieldKey =
  | 'canton'
  | 'employmentRate'
  | 'teleworkDays'
  | 'missionDaysFrance'
  | 'missionDaysThirdState'
  | 'exactTotal'
  | 'startDay';

interface FormState {
  readonly canton: Canton | '';
  readonly employmentRate: string;
  readonly teleworkDays: string;
  readonly hasMissions: boolean;
  readonly missionDaysFrance: string;
  readonly missionDaysThirdState: string;
  readonly method: DenominatorMethod['kind'];
  readonly exactTotal: string;
  readonly granularity: Granularity;
  readonly startDay: string;
}

const NO_DAYS = String(DAYS.min);

/** One shared empty array, so "no errors" is referentially stable. */
const NO_ERRORS: readonly ValidationError[] = [];

const INITIAL: FormState = {
  canton: '',
  employmentRate: String(RATE.max),
  teleworkDays: NO_DAYS,
  hasMissions: false,
  missionDaysFrance: NO_DAYS,
  missionDaysThirdState: NO_DAYS,
  method: 'simplified240',
  exactTotal: '',
  granularity: DEFAULT_GRANULARITY,
  startDay: '',
};

/**
 * A decoded scenario as form state. FW13 increment 2.
 *
 * THE STATE IS STRINGS AND THE SCENARIO IS NUMBERS, so this is a conversion
 * rather than a cast - see the header on FormState for why the controls hold
 * text. Every field is a direct rendering except the start date, which the
 * engine holds as a periodFraction: isoDayForFraction recovers the day that
 * produced it, and returns null for a fraction no date can produce, in which
 * case the field stays empty and the fraction still applies. The same
 * function encode uses, so a seeded form re-encodes to the URL it came from.
 *
 * hasMissions IS DERIVED rather than carried: SPEC 9.4 has no param for it,
 * because the answer is visible in the numbers. A link with mission days
 * reveals the fields; one without leaves them collapsed.
 */
function stateFrom(input: TeleworkInput): FormState {
  const startDay = isoDayForFraction(input.periodFraction, input.taxYear);

  return {
    canton: input.canton,
    employmentRate: String(input.employmentRate),
    teleworkDays: String(input.teleworkDays),
    hasMissions: input.missionDaysFrance > 0 || input.missionDaysThirdState > 0,
    missionDaysFrance: String(input.missionDaysFrance),
    missionDaysThirdState: String(input.missionDaysThirdState),
    method: input.denominator.kind,
    exactTotal:
      input.denominator.kind === 'exact' ? String(input.denominator.totalWorkDays) : '',
    granularity: input.granularity,
    startDay: startDay ?? '',
  };
}

/**
 * Which field an error belongs to, or null for one that belongs to no control.
 *
 * EXHAUSTIVE OVER THE UNION, ending in a `never` assignment, so a new
 * ValidationError code is a compile error here rather than a message that
 * quietly renders nowhere.
 */
function fieldFor(error: ValidationError): FieldKey | null {
  switch (error.code) {
    case 'RATE_OUT_OF_RANGE':
      return 'employmentRate';

    // The period comes from the start date, so that is the control to point
    // at - not the fraction, which the user never sees.
    case 'PERIOD_OUT_OF_RANGE':
      return 'startDay';

    case 'NEGATIVE_DAYS':
    case 'GRANULARITY_MISMATCH':
      switch (error.field) {
        case 'teleworkDays':
          return 'teleworkDays';
        case 'missionDaysFrance':
          return 'missionDaysFrance';
        case 'missionDaysThirdState':
          return 'missionDaysThirdState';
        // validate.ts reports the exact method's supplied total under the
        // 'denominator' field name.
        case 'denominator':
          return 'exactTotal';
        default:
          return null;
      }

    // Not a single field's fault - the SUM of the day counts passed the annual
    // basis. Shown on the telework field because that is the one the user is
    // editing when it happens and the one they can shrink to fix it.
    case 'DAYS_EXCEED_TOTAL':
      return 'teleworkDays';

    case 'TOTAL_WORK_DAYS_NOT_POSITIVE':
      return 'exactTotal';

    default: {
      const exhaustive: never = error;

      return exhaustive;
    }
  }
}

export interface CalculatorFormProps {
  /** Resolved server-side from the Europe/Paris date (R55). */
  readonly taxYear: number;
  /**
   * A scenario to start from, for tests and for a future caller.
   *
   * THE URL IS NOT READ THROUGH THIS PROP. The page is static (see its
   * header), so nothing on the server knows the query string; the island
   * reads it on mount instead. This stays because a seeded form is worth
   * being able to construct directly in a test without a browser URL.
   */
  readonly initial?: TeleworkInput | null;
}

interface RadioGroupProps {
  readonly name: string;
  readonly legend: string;
  readonly helper: string;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/**
 * A radio group, as a fieldset with a legend.
 *
 * NOT FieldGroup, AND THAT IS DELIBERATE. FieldGroup wires exactly ONE
 * control: it renders `<label for={id}>` and hands the caller
 * aria-describedby and aria-invalid to spread onto the thing that id names. A
 * radio group has no single control to name, and `<label for>` pointing at a
 * fieldset is inert - a fieldset is not a labelable element, so the label
 * would look right and announce nothing. A legend IS the group's accessible
 * name, which is the whole reason fieldset exists.
 *
 * Recorded in the report as an interpretation of "every field wrapped in
 * FieldGroup": every field with one control is.
 */
function RadioGroup({ name, legend, helper, options, value, onChange }: RadioGroupProps) {
  const helperId = `${name}-helper`;

  return (
    <fieldset className={styles.group} aria-describedby={helperId}>
      <legend className={styles.groupLegend}>{legend}</legend>
      <p className={styles.groupHelper} id={helperId}>
        {helper}
      </p>
      <div className={styles.choices}>
        {options.map((option) => (
          <label className={styles.choice} key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CalculatorForm({ taxYear, initial = null }: CalculatorFormProps) {
  // SEEDED ONCE, from the server render. useState's initial value is used on
  // the first render and ignored afterwards, which is exactly right here: the
  // URL is where the user STARTED, and from then on the form is the truth and
  // the URL follows it (increment 4).
  const [state, setState] = useState<FormState>(
    initial === null ? INITIAL : stateFrom(initial),
  );

  // The accordion opens for a link that used it, so the reader can see the
  // settings their scenario depends on rather than wondering why the numbers
  // do not match a default calculation.
  /**
   * THE SHARED LINK, READ ON MOUNT. FW13 increment 2.
   *
   * ON THE CLIENT, because the page is static: reading searchParams on the
   * server would move this route's canonical out of <head> (measured - see
   * the page's header), and this is SPEC 14's target-query page.
   *
   * window.location.search RATHER THAN useSearchParams, because that hook
   * forces a Suspense boundary on a static route and returns nothing during
   * prerender anyway. Reading the location once, after mount, is the same
   * information with no boundary and no build-time constraint.
   *
   * ONCE, NOT ON EVERY CHANGE. The URL is where the reader STARTED; from
   * mount onwards the form is the truth and the URL follows it (increment
   * 4). An effect that re-read the location would fight its own writes.
   */
  const [link, setLink] = useState<{
    readonly ignored: readonly string[];
    readonly invalid: readonly string[];
  }>({ ignored: [], invalid: [] });

  useEffect(() => {
    const query = window.location.search;

    if (query === '' || query === '?') return;

    const decoded = decode(new URLSearchParams(query), taxYear);

    if (decoded.input !== null) setState(stateFrom(decoded.input));

    setLink({ ignored: decoded.ignored, invalid: decoded.invalid });

    if (
      decoded.input !== null &&
      (decoded.input.denominator.kind === 'exact' || decoded.input.periodFraction < 1)
    ) {
      setAdvancedOpen(true);
    }
    // Mount only, deliberately: see the comment above. The dependency
    // array is empty because re-reading the location would fight the writes
    // increment 4 makes to it.
  }, []);

  // SPEC 9.4 requires the link notice to be DISMISSIBLE. Dismissed in state
  // rather than removed from the DOM by the reader's browser, so it comes
  // back on the next shared link rather than staying hidden for the session.
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const rules = ruleSetFor(taxYear);

  /**
   * The engine input, or null while the form cannot make one.
   *
   * Recomputed on every render rather than debounced: SPEC 9.3 and standing
   * protocol 7 both say so, and the reason is that the engine runs in well
   * under a millisecond, so a debounce would add perceived lag and nothing
   * else. useMemo is here for referential stability of the errors array, not
   * as a performance measure.
   */
  const input = useMemo<TeleworkInput | null>(() => {
    if (state.canton === '') return null;

    const denominator: DenominatorMethod =
      state.method === 'exact'
        ? { kind: 'exact', totalWorkDays: parseNumeric(state.exactTotal) }
        : { kind: 'simplified240' };

    return {
      taxYear,
      canton: state.canton,
      employmentRate: parseNumeric(state.employmentRate),
      periodFraction: fractionFor(state.startDay, taxYear),
      denominator,
      granularity: state.granularity,
      teleworkDays: parseNumeric(state.teleworkDays),
      missionDaysFrance: parseNumeric(state.missionDaysFrance),
      missionDaysThirdState: parseNumeric(state.missionDaysThirdState),
    };
  }, [state, taxYear]);

  /**
   * The engine's answer, kept whole.
   *
   * ONE CALL, NOT TWO. The errors and the result are the two branches of the
   * same Result, so computing them separately would run the engine twice per
   * keystroke and - worse - could show a result and an error that came from
   * different inputs if the memo dependencies ever drifted apart.
   */
  const outcome = useMemo(
    () => (input === null ? null : calculateTelework(input)),
    [input],
  );

  const reported: readonly ValidationError[] =
    outcome !== null && !outcome.ok ? outcome.error : NO_ERRORS;

  /**
   * The engine's errors, minus the one that is only ever a restatement.
   *
   * FOUND IN A BASELINE, not by a test. Increment 5's error screenshot showed
   * the rate field correctly marked "Le taux d'activite doit etre compris
   * entre 1 et 100" and, in the form-level list under it, "Le nombre de jours
   * travailles dans la periode doit etre superieur a zero". Two messages for
   * one mistake, and the second one names a quantity the user has never seen.
   *
   * THE ENGINE IS RIGHT TO SEND BOTH. validate.ts resolves the denominator
   * from the rate it was given, so a rate of 0 makes ceil(basis x 0 x period)
   * zero and TOTAL_WORK_DAYS_NOT_POSITIVE is simply true. Choosing which of
   * two true statements a person should read is the form's job, not the
   * engine's - and it is the form that knows the total is not a field here.
   *
   * SUPPRESSED ONLY WHEN IT IS DERIVED, which under the simplified basis is
   * always: with a rate of at least 1 and a period above 0 the total is the
   * ceiling of a positive number, so it is at least 1 and the error cannot
   * arise on its own. Under the EXACT method the user supplies the number,
   * nothing else explains it, and hiding it would leave a form that refuses
   * to calculate and says nothing about why.
   */
  const errors: readonly ValidationError[] =
    state.method === 'exact'
      ? reported
      : reported.filter((error) => error.code !== 'TOTAL_WORK_DAYS_NOT_POSITIVE');

  const result: TeleworkResult | null = outcome !== null && outcome.ok ? outcome.value : null;


  /**
   * Which fields are on screen right now.
   *
   * Errors are routed by this and not by the code alone, because a field
   * behind a collapsed disclosure cannot show anything. Without it, entering
   * a start date in the wrong year and then closing the accordion would make
   * the engine's message disappear while the form stayed un-calculable.
   */
  const visible = new Set<FieldKey>(['canton', 'employmentRate', 'teleworkDays']);

  if (state.hasMissions) {
    visible.add('missionDaysFrance');
    visible.add('missionDaysThirdState');
  }

  if (advancedOpen) {
    visible.add('startDay');

    if (state.method === 'exact') visible.add('exactTotal');
  }

  const errorFor = (field: FieldKey): string | undefined => {
    const hit = errors.find((error) => fieldFor(error) === field);

    return hit === undefined ? undefined : errorMessage(hit);
  };

  /** Errors with no field, or whose field the user cannot currently see. */
  const unplaced = errors.filter((error) => {
    const field = fieldFor(error);

    return field === null || !visible.has(field);
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const stepNumeric = (
    key: 'employmentRate' | 'teleworkDays' | 'missionDaysFrance' | 'missionDaysThirdState',
    delta: number,
    min: number,
    max: number | null,
  ) => {
    setState((current) => {
      const parsed = parseNumeric(current[key]);
      const from = Number.isFinite(parsed) ? parsed : min;
      const raised = Math.max(min, from + delta);
      const next = max === null ? raised : Math.min(max, raised);

      return { ...current, [key]: String(next) };
    });
  };

  /** A number field with its two stepper buttons. Four of these exist. */
  const numericField = (config: {
    readonly id: string;
    readonly stateKey:
      | 'employmentRate'
      | 'teleworkDays'
      | 'missionDaysFrance'
      | 'missionDaysThirdState';
    readonly field: FieldKey;
    readonly label: string;
    readonly helper: string;
    readonly decrease: string;
    readonly increase: string;
    readonly step: number;
    readonly min: number;
    readonly max: number | null;
  }) => (
    <FieldGroup
      id={config.id}
      label={config.label}
      helper={config.helper}
      error={errorFor(config.field)}
    >
      {(control) => (
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.step}
            aria-label={config.decrease}
            onClick={() => {
              stepNumeric(config.stateKey, -config.step, config.min, config.max);
            }}
          >
            <Minus size={ICON} strokeWidth={STROKE} aria-hidden="true" />
          </button>
          {/*
            NO step, min OR max ATTRIBUTE. All three are inert on a text
            input, so rendering them would read as a bound the browser was
            enforcing while nothing was. The real bounds are the stepper's
            clamp below and the engine's own validation, both tested.

            config still carries them: the stepper arithmetic needs them.
          */}
          <input
            {...control}
            type="text"
            inputMode="decimal"
            className={styles.number}
            value={state[config.stateKey]}
            onChange={(event) => {
              set(config.stateKey, event.target.value);
            }}
          />
          <button
            type="button"
            className={styles.step}
            aria-label={config.increase}
            onClick={() => {
              stepNumeric(config.stateKey, config.step, config.min, config.max);
            }}
          >
            <Plus size={ICON} strokeWidth={STROKE} aria-hidden="true" />
          </button>
        </div>
      )}
    </FieldGroup>
  );

  /**
   * RULING R110: which pending readings THIS input depends on.
   *
   * Derived from the input rather than from the result, so it is right while
   * the numbers are still invalid: the reading the user's configuration
   * depends on does not become relevant only once the form validates. It is
   * also why this reads the input and not result.warnings - the engine has no
   * opinion about which of its rules are settled.
   */
  const provisional = input === null ? [] : provisionalFor(input);

  return (
    <>
      <fieldset className={styles.card}>
        <legend className={styles.legend}>{COPY.legend}</legend>

        <FieldGroup
          id="canton"
          label={COPY.canton.label}
          helper={COPY.canton.helper}
          error={errorFor('canton')}
        >
          {(control) => (
            <select
              {...control}
              className={styles.select}
              value={state.canton}
              onChange={(event) => {
                set('canton', event.target.value as Canton | '');
              }}
            >
              <option value="">{COPY.canton.placeholder}</option>
              {CANTONS_BY_NAME.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </FieldGroup>

        {numericField({
          id: 'taux-activite',
          stateKey: 'employmentRate',
          field: 'employmentRate',
          label: COPY.rate.label,
          helper: COPY.rate.helper,
          decrease: COPY.rate.decrease,
          increase: COPY.rate.increase,
          step: RATE.step,
          min: RATE.min,
          max: RATE.max,
        })}

        {numericField({
          id: 'jours-teletravail',
          stateKey: 'teleworkDays',
          field: 'teleworkDays',
          label: COPY.days.label,
          helper: COPY.days.helper,
          decrease: COPY.days.decrease,
          increase: COPY.days.increase,
          step: DAYS.step,
          min: DAYS.min,
          max: null,
        })}

        {/*
          THE MISSION QUESTION, above the accordion and never inside it. SPEC
          9.3's one exception to progressive disclosure, because a user with
          missions who never opens the accordion gets a silently wrong answer.
        */}
        <RadioGroup
          name="missions"
          legend={COPY.missions.question}
          helper={COPY.missions.helper(fiscalCeiling(taxYear))}
          value={state.hasMissions ? COPY.missions.yes : COPY.missions.no}
          options={[
            { value: COPY.missions.no, label: COPY.missions.no },
            { value: COPY.missions.yes, label: COPY.missions.yes },
          ]}
          onChange={(value) => {
            const yes = value === COPY.missions.yes;

            // RESET ON "Non", not merely hide. A hidden field keeps its value
            // and keeps feeding the calculation, so answering Oui, typing 12
            // and thinking better of it would compute from 12 mission days the
            // user can no longer see - the exact "silently wrong answer" this
            // question exists to prevent, reintroduced by the reveal.
            setState((current) => ({
              ...current,
              hasMissions: yes,
              missionDaysFrance: yes ? current.missionDaysFrance : NO_DAYS,
              missionDaysThirdState: yes ? current.missionDaysThirdState : NO_DAYS,
            }));
          }}
        />

        {!state.hasMissions ? null : (
          <div className={styles.revealed}>
            {numericField({
              id: 'missions-france',
              stateKey: 'missionDaysFrance',
              field: 'missionDaysFrance',
              label: COPY.missions.france.label,
              helper: COPY.missions.fieldHelper,
              decrease: COPY.days.decrease,
              increase: COPY.days.increase,
              step: DAYS.step,
              min: DAYS.min,
              max: null,
            })}
            {numericField({
              id: 'missions-pays-tiers',
              stateKey: 'missionDaysThirdState',
              field: 'missionDaysThirdState',
              label: COPY.missions.thirdState.label,
              helper: COPY.missions.fieldHelper,
              decrease: COPY.days.decrease,
              increase: COPY.days.increase,
              step: DAYS.step,
              min: DAYS.min,
              max: null,
            })}
          </div>
        )}

        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={advancedOpen}
          aria-controls="options-avancees"
          onClick={() => {
            setAdvancedOpen((open) => !open);
          }}
        >
          <ChevronDown
            size={ICON}
            strokeWidth={STROKE}
            aria-hidden="true"
            className={advancedOpen ? styles.chevronOpen : styles.chevron}
          />
          <span>{COPY.advanced.summary}</span>
        </button>

        {/*
          NOT RENDERED WHEN CLOSED, and the first version of this comment
          overclaimed why. It said a display:none control "is still focusable",
          which a probe disproved: hiding this panel with the hidden attribute
          instead kept the keyboard test green, because hidden implies
          display:none and display:none really does take descendants out of the
          tab order.

          So the honest reason is narrower. Not rendering cannot be got wrong,
          where hiding can: visibility, opacity, height 0 and aria-hidden alone
          all leave a focusable control behind, and each is one careless edit
          away from the correct version. There is also no state to keep in sync
          - no aria-hidden to toggle, nothing to remember to untoggle.

          Increment 5's keyboard path asserts that a closed accordion
          contributes no tab stops, which is the property that matters. It does
          NOT distinguish this implementation from a correct display:none one,
          and the probe is why that is stated rather than assumed.
        */}
        <div id="options-avancees">
          {!advancedOpen ? null : (
            <div className={styles.advanced}>
              <RadioGroup
                name="methode"
                legend={COPY.method.label}
                helper={COPY.method.helper(formatDays(rules.simplifiedBasisDays))}
                value={state.method}
                options={[
                  { value: 'simplified240', label: COPY.method.simplified },
                  { value: 'exact', label: COPY.method.exact },
                ]}
                onChange={(value) => {
                  const exact = value === 'exact';

                  // PREFILLED FROM THE RULE SET when the exact method is
                  // chosen, and this is an interpretation the report records.
                  // SPEC 9.3 says the user supplies the total; an empty field
                  // reaches the engine as NaN, which it reports as "cannot be
                  // negative" - a wrong message about a field nobody has typed
                  // in yet. The simplified basis is the number the calculation
                  // was already using, so starting there states the default
                  // rather than inventing one.
                  setState((current) => ({
                    ...current,
                    method: exact ? 'exact' : 'simplified240',
                    exactTotal:
                      exact && current.exactTotal === ''
                        ? String(rules.simplifiedBasisDays)
                        : current.exactTotal,
                  }));
                }}
              />

              {state.method !== 'exact' ? null : (
                <FieldGroup
                  id="total-jours"
                  label={COPY.method.totalLabel}
                  helper={COPY.method.totalHelper}
                  error={errorFor('exactTotal')}
                >
                  {(control) => (
                    <input
                      {...control}
                      type="text"
                      inputMode="decimal"
                      className={styles.number}
                      value={state.exactTotal}
                      onChange={(event) => {
                        set('exactTotal', event.target.value);
                      }}
                    />
                  )}
                </FieldGroup>
              )}

              <RadioGroup
                name="decompte"
                legend={COPY.decompte.label}
                helper={COPY.decompte.helper}
                value={state.granularity}
                options={[
                  { value: 'day', label: COPY.decompte.day },
                  { value: 'halfDay', label: COPY.decompte.halfDay },
                  { value: 'hours', label: COPY.decompte.hours },
                ]}
                onChange={(value) => {
                  set('granularity', value as Granularity);
                }}
              />

              <FieldGroup
                id="debut-activite"
                label={COPY.start.label}
                helper={COPY.start.helper}
                error={errorFor('startDay')}
              >
                {(control) => (
                  <input
                    {...control}
                    type="date"
                    className={styles.date}
                    value={state.startDay}
                    onChange={(event) => {
                      set('startDay', event.target.value);
                    }}
                  />
                )}
              </FieldGroup>
            </div>
          )}
        </div>

        {unplaced.length === 0 ? null : (
          <div className={styles.otherErrors}>
            <p className={styles.otherErrorsLabel}>{COPY.otherErrorsLabel}</p>
            <ul className={styles.otherErrorsList}>
              {unplaced.map((error) => (
                <li key={error.code}>{errorMessage(error)}</li>
              ))}
            </ul>
          </div>
        )}

        {/*
          FD1 PUTS A PRIMARY BUTTON HERE and the result is already live, so
          this one navigates rather than computes: it scrolls the result into
          view and takes focus there. A form full of numbers with no button at
          all reads as unfinished, and a button that recomputed what is
          already computed would be a lie about how the page works.

          type="button". A submit would reload the page on Enter and lose
          everything typed, which on a form with no persistence is the worst
          available outcome.
        */}
        <button
          type="button"
          className={styles.calculate}
          onClick={() => {
            /*
              BY ID, NOT BY REF, since increment 1. The live region is
              rendered by the island while there is nothing to show and by
              ResultPanel once there is, so a ref attached in one branch is
              null in the other - and the button would silently stop moving
              focus exactly when there was finally a result to move it to.
            */
            const region = document.getElementById(RESULT_ID);

            if (region === null) return;

            // Guarded rather than called: jsdom implements no layout and has
            // no scrollIntoView, so an unguarded call turns every test that
            // presses this button into a TypeError.
            if (typeof region.scrollIntoView === 'function') {
              region.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            region.focus();
          }}
        >
          {RESULT.calculate}
        </button>
      </fieldset>

      {/*
        THE RESULT AREA, and it is rendered by TWO components depending on
        state.

        ResultPanel needs a TeleworkResult - it computes nothing and has
        nothing to render without one - so while the input is incomplete or
        invalid the island keeps a region of its own with the same id, live
        politeness and focus target. The alternative was a panel that accepts
        a null result and branches internally, which would put the empty
        state inside a component whose whole contract is "receives a result".

        R110's NOTICE SITS ABOVE BOTH, AND STAYED HERE IN INCREMENT 5.

        The plan was to move it inside the panel. It is not there, and the
        reason is the sentence two paragraphs up: the notice is derived from
        the INPUT, the panel renders only when there is a RESULT, and those
        two are not the same states. A reader who has just typed a rate of 0
        has no result and is being shown an error - and is exactly the reader
        who should still be told that their mission-day configuration depends
        on a reading awaiting review, because they are about to correct the
        number and act on the answer.

        Moving it in would have silenced it for every invalid input, which is
        a regression dressed as tidiness. Rendering it in BOTH branches would
        have meant two call sites for one banner - the failure increment 4
        just removed for RULE_SET_FALLBACK. One call site, above a region
        whose contents change underneath it, is both.

        What increment 5 actually adds is the DESTINATION: a link per named
        reading to that reading on /sources. provisional-notice.test.tsx
        asserts the survives-invalid-input property directly, so this
        decision is a failing test if anyone moves it later.
      */}
      {/*
        FW13 increment 2: THE LINK NOTICE. SPEC 9.4: "invalid values fall
        back to default and surface a dismissible notice, never a blank page
        (Facebook mangles URLs; degrading beats 404)."

        ABOVE THE RESULT AND ABOVE THE PROVISIONAL NOTICE, because it is
        about the LINK rather than about the calculation: a reader who does
        not know a value was dropped has no reason to check the fields, and
        the numbers below are a correct answer to the wrong scenario.

        IT RENDERS FROM SERVER-DECODED PROPS, so it is in the first paint
        with the result it qualifies - not announced a moment later by an
        effect, which would be the one arrangement worse than silence.
      */}
      {noticeDismissed || (link.ignored.length === 0 && link.invalid.length === 0) ? null : (
        <div className={styles.linkNotice} data-notice="params">
          <p className={styles.linkNoticeLead}>{PARAM_NOTICE.lead}</p>
          {link.invalid.length === 0 ? null : (
            <p className={styles.linkNoticeBody}>{PARAM_NOTICE.invalid(link.invalid)}</p>
          )}
          {link.ignored.length === 0 ? null : (
            <p className={styles.linkNoticeBody}>{PARAM_NOTICE.ignored(link.ignored)}</p>
          )}
          <p className={styles.linkNoticeBody}>{PARAM_NOTICE.advice}</p>
          <button
            className={styles.linkNoticeDismiss}
            onClick={() => {
              setNoticeDismissed(true);
            }}
            type="button"
          >
            {PARAM_NOTICE.dismiss}
          </button>
        </div>
      )}

      {provisional.length === 0 ? null : (
        <div className={styles.provisional} data-notice="provisional">
          <p className={styles.provisionalLead}>{PROVISIONAL_COPY.lead}</p>
          <ul className={styles.provisionalList}>
            {provisional.map((id) => (
              <li key={id}>
                <span className={styles.provisionalName}>
                  {PROVISIONAL_COPY.items[id].interpretation}
                </span>
                {PROVISIONAL_COPY.items[id].body}{' '}
                {/*
                  ONE LINK PER READING, to that reading. The notice knows
                  which of the three the input touches, so sending the reader
                  to a page listing three would throw that away. A plain
                  anchor per R87, and no target - it is our own page.

                  /sources IS LIVE (increment 0), which is why this is an
                  anchor and not ctaHrefIfLive's pending text. It is also the
                  route whose absence was the hole R113 was written about.
                */}
                <a className={styles.provisionalLink} href={`/sources#${readingAnchor(id)}`}>
                  {PROVISIONAL_COPY.readMore}
                </a>
              </li>
            ))}
          </ul>
          <p className={styles.provisionalPending}>{PROVISIONAL_COPY.pending}</p>
        </div>
      )}

      {input === null || result === null ? (
        <section className={styles.resultCard} aria-labelledby={RESULT_TITLE_ID}>
          <h2 className={styles.resultHeading} id={RESULT_TITLE_ID}>
            {RESULT.heading}
          </h2>

          <div
            className={styles.resultLive}
            id={RESULT_ID}
            aria-live="polite"
            tabIndex={-1}
          >
            {/*
              result === null IS EXACTLY "the input is invalid". A mutation
              probe in FW11 removed an `errors.length > 0 ||` clause from this
              condition and NOT ONE TEST CHANGED - calculateTelework returns a
              Result, so a result and an error can never coexist. The "never
              show a stale number" guarantee comes from the engine's return
              type, not from a check here.
            */}
            <p className={styles.resultNote}>
              {input === null ? RESULT.empty : RESULT.stale}
            </p>
          </div>
        </section>
      ) : (
        <ResultPanel result={result} thresholds={rules} />
      )}
    </>
  );
}

/**
 * The fiscal ceiling, formatted the way the page's prose formats it.
 *
 * Duplicated from page.tsx rather than shared, because sharing it would mean
 * exporting a formatting helper from a server component into a client one -
 * and the two are the same three lines for the same reason: no decimal on a
 * whole percentage. If a third caller appears it moves to lib/ui/core.
 */
function fiscalCeiling(taxYear: number): string {
  const percent = ruleSetFor(taxYear).fiscalCeiling * 100;

  return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
}
