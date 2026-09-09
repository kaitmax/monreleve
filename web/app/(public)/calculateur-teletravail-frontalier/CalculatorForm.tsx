// web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.tsx
//
// The client island. One useState, no form library, no schema library: the
// engine's validation IS the validation (standing protocol 5), and its Result
// feeds FieldGroup.
//
// WHY THE STATE IS NOT A TeleworkInput, although the prompt describes it as
// one. Two of its fields cannot hold what a half-typed form contains:
//
//   canton         has no sane default and no empty member. TeleworkInput
//                  requires a Canton, so there is no value to put there
//                  before the user chooses - and inventing one would compute
//                  a regime for a canton nobody selected.
//   the numbers    are TEXT while being typed. An empty field is not 0: if
//                  clearing the day count silently became zero, the form
//                  would answer a question the user was in the middle of
//                  un-asking. Number('') IS 0, which is exactly that bug.
//
// So the state holds what the CONTROLS hold, and buildInput turns it into a
// TeleworkInput when it can. That boundary is also where a decimal comma is
// normalised - see NUMERIC_FIELD_NOTE.
//
// VALIDATION GOES THROUGH calculateTelework. validateInput is internal to the
// engine and exporting it would be a change to the engine's public API, which
// SPEC 20 makes an ask-first item; the report asks. The consequence is that
// nothing is validated until a canton exists, because that is what it takes to
// build an input at all.

'use client';

import { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  type Canton,
  type TeleworkInput,
  type ValidationError,
  calculateTelework,
} from '@/lib/calc-engine';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { CANTONS_BY_NAME } from '@/lib/fr/cantons';
import { errorMessage } from '@/lib/fr/errors';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import styles from './CalculatorForm.module.scss';

const COPY = CALCULATEUR_COPY.form;

const ICON = 20;
const STROKE = 1.75;

/**
 * The control bounds, matching SPEC 9.3's table.
 *
 * The rate's minimum is 1 rather than 0 because that is the range the engine
 * accepts (RATE_OUT_OF_RANGE below 1): a contract at nothing per cent is not
 * a contract. The day field has no maximum here on purpose - the real ceiling
 * is the annual basis, which depends on the rate and the method, and the
 * engine reports DAYS_EXCEED_TOTAL when it is passed. A hand-typed max would
 * be a fourth place the 240 lives.
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
 * stated. 'day' remains available in the accordion (increment 3), where
 * choosing it makes 0,5 an error, correctly.
 */
const DEFAULT_GRANULARITY = 'halfDay';

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

/** The fields that can show an error today. The accordion adds its own. */
type FieldKey = 'canton' | 'employmentRate' | 'teleworkDays';

interface FormState {
  readonly canton: Canton | '';
  readonly employmentRate: string;
  readonly teleworkDays: string;
}

const INITIAL: FormState = {
  canton: '',
  employmentRate: String(RATE.max),
  teleworkDays: String(DAYS.min),
};

/**
 * Which visible field an error belongs to, or null for one that belongs to a
 * control this increment has not built yet.
 *
 * EXHAUSTIVE OVER THE UNION, ending in a `never` assignment, so a new
 * ValidationError code is a compile error here rather than a message that
 * quietly renders nowhere. The null cases are not oversights: periodFraction
 * is fixed at 1 and the denominator is fixed to the simplified basis until the
 * accordion exists, so those codes are unreachable today - and when they
 * become reachable the fields they name will be there to hold them. Until
 * then anything null still reaches the user through the form-level list.
 */
function fieldFor(error: ValidationError): FieldKey | null {
  switch (error.code) {
    case 'RATE_OUT_OF_RANGE':
      return 'employmentRate';

    case 'NEGATIVE_DAYS':
    case 'GRANULARITY_MISMATCH':
      return error.field === 'teleworkDays' ? 'teleworkDays' : null;

    // Not a single field's fault - the SUM of the day counts passed the annual
    // basis. Shown on the telework field because that is the one the user is
    // editing when it happens and the one they can shrink to fix it.
    case 'DAYS_EXCEED_TOTAL':
      return 'teleworkDays';

    // Both belong to accordion controls: the start date and the exact
    // method's total.
    case 'PERIOD_OUT_OF_RANGE':
    case 'TOTAL_WORK_DAYS_NOT_POSITIVE':
      return null;

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

export function CalculatorForm({ taxYear }: CalculatorFormProps) {
  const [state, setState] = useState<FormState>(INITIAL);

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

    return {
      taxYear,
      canton: state.canton,
      employmentRate: parseNumeric(state.employmentRate),
      periodFraction: 1,
      denominator: { kind: 'simplified240' },
      granularity: DEFAULT_GRANULARITY,
      teleworkDays: parseNumeric(state.teleworkDays),
      missionDaysFrance: 0,
      missionDaysThirdState: 0,
    };
  }, [state, taxYear]);

  const errors = useMemo<readonly ValidationError[]>(() => {
    if (input === null) return [];

    const outcome = calculateTelework(input);

    return outcome.ok ? [] : outcome.error;
  }, [input]);

  /** The first error for a field, as French text. FieldGroup takes one. */
  const errorFor = (field: FieldKey): string | undefined => {
    const hit = errors.find((error) => fieldFor(error) === field);

    return hit === undefined ? undefined : errorMessage(hit);
  };

  const unplaced = errors.filter((error) => fieldFor(error) === null);

  const stepRate = (delta: number) => {
    setState((current) => {
      const value = parseNumeric(current.employmentRate);
      const from = Number.isFinite(value) ? value : RATE.max;
      const next = Math.min(RATE.max, Math.max(RATE.min, from + delta));

      return { ...current, employmentRate: String(next) };
    });
  };

  const stepDays = (delta: number) => {
    setState((current) => {
      const value = parseNumeric(current.teleworkDays);
      const from = Number.isFinite(value) ? value : DAYS.min;
      const next = Math.max(DAYS.min, from + delta);

      return { ...current, teleworkDays: String(next) };
    });
  };

  return (
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
              setState((current) => ({
                ...current,
                canton: event.target.value as Canton | '',
              }));
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

      <FieldGroup
        id="taux-activite"
        label={COPY.rate.label}
        helper={COPY.rate.helper}
        error={errorFor('employmentRate')}
      >
        {(control) => (
          <div className={styles.stepper}>
            <button
              type="button"
              className={styles.step}
              aria-label={COPY.rate.decrease}
              onClick={() => stepRate(-RATE.step)}
            >
              <Minus size={ICON} strokeWidth={STROKE} aria-hidden="true" />
            </button>
            <input
              {...control}
              type="number"
              className={styles.number}
              step={RATE.step}
              min={RATE.min}
              max={RATE.max}
              value={state.employmentRate}
              onChange={(event) => {
                setState((current) => ({ ...current, employmentRate: event.target.value }));
              }}
            />
            <button
              type="button"
              className={styles.step}
              aria-label={COPY.rate.increase}
              onClick={() => stepRate(RATE.step)}
            >
              <Plus size={ICON} strokeWidth={STROKE} aria-hidden="true" />
            </button>
          </div>
        )}
      </FieldGroup>

      <FieldGroup
        id="jours-teletravail"
        label={COPY.days.label}
        helper={COPY.days.helper}
        error={errorFor('teleworkDays')}
      >
        {(control) => (
          <div className={styles.stepper}>
            <button
              type="button"
              className={styles.step}
              aria-label={COPY.days.decrease}
              onClick={() => stepDays(-DAYS.step)}
            >
              <Minus size={ICON} strokeWidth={STROKE} aria-hidden="true" />
            </button>
            <input
              {...control}
              type="number"
              className={styles.number}
              step={DAYS.step}
              min={DAYS.min}
              value={state.teleworkDays}
              onChange={(event) => {
                setState((current) => ({ ...current, teleworkDays: event.target.value }));
              }}
            />
            <button
              type="button"
              className={styles.step}
              aria-label={COPY.days.increase}
              onClick={() => stepDays(DAYS.step)}
            >
              <Plus size={ICON} strokeWidth={STROKE} aria-hidden="true" />
            </button>
          </div>
        )}
      </FieldGroup>

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
    </fieldset>
  );
}
