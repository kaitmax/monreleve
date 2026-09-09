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

import { useMemo, useRef, useState } from 'react';
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
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { CANTONS_BY_NAME } from '@/lib/fr/cantons';
import { errorMessage } from '@/lib/fr/errors';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import { formatDays, formatPercent, remainingYearFraction, zoneFor } from '@/lib/ui/core';
import { RateDisplay } from '@/lib/ui/react/RateDisplay/RateDisplay';
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
 * NUMERIC_FIELD_NOTE - a decimal comma, and an open question.
 *
 * A French user writes "83,5". SPEC 9.3 specifies `type="number"`, and a
 * number input in every major browser treats a comma as invalid: the value
 * arrives here as the empty string and the digits the user typed appear to
 * vanish. Normalising the comma here costs one line and fixes the cases where
 * the value does reach us; it CANNOT fix the browser discarding it first.
 *
 * The fix would be type="text" with inputMode="decimal", which contradicts
 * SPEC 9.3, and R86 says SPEC wins. So the spec is followed, the normalisation
 * is kept for the cases it helps, and the report carries the question.
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

export function CalculatorForm({ taxYear }: CalculatorFormProps) {
  const [state, setState] = useState<FormState>(INITIAL);
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
   * THE PREVIOUS RESULT IS DELIBERATELY NOT RETAINED, which departs from the
   * increment's wording and is recorded in the report.
   *
   * The prompt asks for the last result to be held in state while the input
   * is invalid. In the same breath it forbids the only thing such a value
   * could be used for: "the result region never shows a stale number as
   * current". So a retained result would be state nothing reads - and unused
   * state on a live region is how a stale number eventually gets rendered by
   * somebody who finds it there and assumes it is meant to be shown.
   *
   * FW12's panel may genuinely need it, to avoid tearing down a rail and four
   * tiles on every keystroke. It can add it then, with something that reads
   * it.
   */
  const resultRegion = useRef<HTMLDivElement | null>(null);

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
          <input
            {...control}
            type="number"
            className={styles.number}
            step={config.step}
            min={config.min}
            {...(config.max === null ? {} : { max: config.max })}
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

  const fallback = result?.warnings.find((warning) => warning.code === 'RULE_SET_FALLBACK');

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
                      type="number"
                      className={styles.number}
                      step={DAYS.step}
                      min={DAYS.min}
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
            const region = resultRegion.current;

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
        THE PROVISIONAL RESULT. FW12 replaces the inside of this region with
        the full panel; the region itself - id, live politeness, focus target -
        is what increment 4 establishes.

        aria-live SITS ON THE INNER DIV, not on the section, so the heading is
        not re-announced every time a digit changes. The section is named by
        that heading through aria-labelledby instead.

        POLITE, not assertive. The rate changes on every keystroke by design,
        and an assertive region would interrupt the screen reader mid-word on
        each one.
      */}
      <section className={styles.resultCard} aria-labelledby={RESULT_TITLE_ID}>
        <h2 className={styles.resultHeading} id={RESULT_TITLE_ID}>
          {RESULT.heading}
        </h2>

        <div
          className={styles.resultLive}
          id={RESULT_ID}
          ref={resultRegion}
          aria-live="polite"
          tabIndex={-1}
        >
          {input === null ? (
            <p className={styles.resultNote}>{RESULT.empty}</p>
          ) : result === null ? (
            /*
              result === null IS EXACTLY "the input is invalid", and this
              condition used to read `errors.length > 0 || result === null`.
              A mutation probe removed the first clause and NOT ONE TEST
              CHANGED - because calculateTelework returns a Result, so a
              result and an error can never both exist. The clause was dead.

              Which is worth stating rather than deleting quietly: the
              increment asks that "the result region never shows a stale
              number as current", and that guarantee comes from the engine's
              return type, not from a check in the UI. There is no code path
              here that could render a number belonging to earlier input,
              because no such number is ever in hand.
            */
            <p className={styles.resultNote}>{RESULT.stale}</p>
          ) : (
            <>
              {fallback === undefined ? null : (
                <div className={styles.fallback}>
                  <p className={styles.fallbackLead}>{RESULT.fallbackLead}</p>
                  <p className={styles.fallbackBody}>
                    {RESULT.fallback(fallback.requestedYear, fallback.appliedYear)}
                  </p>
                </div>
              )}

              {/*
                THE DECLARABLE RATE ONLY. SPEC 9.3 requires both rates and
                names 45,0 % for Geneva case (c), but the prompt makes this
                "the end-to-end seam FW12 completes with the two rates" - so
                rawRate is not passed, and RateDisplay renders the secondary
                figure only when it is.
              */}
              <RateDisplay
                declarableRate={result.declarableRate}
                zone={zoneFor(result.declarableRate, rules)}
              />
            </>
          )}
        </div>
      </section>
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
