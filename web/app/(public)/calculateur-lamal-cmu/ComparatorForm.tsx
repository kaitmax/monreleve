// web/app/(public)/calculateur-lamal-cmu/ComparatorForm.tsx
//
// The comparator's island. FW-COMPARATEUR, R658 (the prompt's R642).
//
// ZERO STORAGE OF WHAT THE PERSON TYPES. The arithmetic runs here, in the
// browser, on lib/lamal - nothing is sent anywhere. No income in a URL, a
// log or an analytics event:
//
//   - NO CONTROL CARRIES A `name`. A <form> submits only named controls, so
//     the native submission that happens before hydration (or with scripting
//     off) - an Enter in the income field - sends an empty query, never the
//     income. With the island running, onSubmit preventDefaults first.
//   - The form has no `action` and no `method`: if it ever submits natively
//     it reloads this same static page with nothing attached.
//   - comparator_calculated carries no value at all (SPEC 15; events.ts).
//
// THE BANNER IS THE PAGE'S since FW-CALCS-A2 (R729): SPEC 9.6's
// irrevocability warning, in the error style, now directly under the page
// head - above the form AND the result, whether or not there is one yet
// (R642, R658). The page is a server component, so it is in the HTML with
// scripting off, as before.
//
// THE ISLAND RENDERS TWO COLUMNS (R729): the form card and the result
// region. The page's grid sets them side by side from the md breakpoint.

'use client';

import { type FormEvent, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { comparatorCalculated } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { compare } from '@/lib/lamal/compare';
import { parseBirthYear, parseIncome } from '@/lib/lamal/input';
import { AVAILABLE_YEARS, DEFAULT_YEAR } from '@/lib/lamal/years';
import { LAMAL_COPY as COPY } from '@/lib/fr/lamal';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import { ComparisonPanel, type PanelState } from '@/lib/ui/react/Comparison/ComparisonPanel';
import styles from './comparateur.module.scss';

interface PersonDraft {
  readonly key: number;
  readonly birthYear: string;
  readonly withAccident: boolean;
}

/** A household larger than this is not a frontalier's family; the button goes away. */
const MAX_PERSONS = 10;

/**
 * FIXED IDS, not useId(). There is one comparator per page, and the e2e and
 * visual specs address the fields by these names; useId's ":r0:" values would
 * tie them to React's render order.
 */
const ID = {
  form: 'comparateur-titre',
  year: 'annee-comparee',
  income: 'revenu-fiscal',
  birthYear: (key: number): string => `naissance-${key}`,
  accident: (key: number): string => `accidents-${key}`,
} as const;

interface Errors {
  readonly income?: string;
  readonly persons: Readonly<Record<number, string>>;
}

const NO_ERRORS: Errors = { persons: {} };

export function ComparatorForm() {
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [income, setIncome] = useState('');
  const [persons, setPersons] = useState<readonly PersonDraft[]>([
    // R667: the frontalier first, WITHOUT accident cover by default.
    { key: 0, birthYear: '', withAccident: false },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  const [panel, setPanel] = useState<PanelState | null>(null);

  const update = (key: number, change: Partial<PersonDraft>): void =>
    setPersons((current) => current.map((person) => (person.key === key ? { ...person, ...change } : person)));

  const add = (): void => {
    // Everybody but the frontalier defaults to WITH accident cover: nothing
    // says they are insured under the LAA (row L6).
    setPersons((current) => [...current, { key: nextKey, birthYear: '', withAccident: true }]);
    setNextKey(nextKey + 1);
  };

  const remove = (key: number): void => setPersons((current) => current.filter((person) => person.key !== key));

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const incomeEur = parseIncome(income);
    const personErrors: Record<number, string> = {};
    const parsed = persons.map((person) => {
      const birthYear = parseBirthYear(person.birthYear);

      if (birthYear === undefined || birthYear > year) personErrors[person.key] = COPY.errors.birthYear(year);

      return { birthYear: birthYear ?? Number.NaN, withAccident: person.withAccident };
    });

    const next: Errors = {
      ...(incomeEur === undefined ? { income: COPY.errors.income } : {}),
      persons: personErrors,
    };

    if (next.income !== undefined || Object.keys(personErrors).length > 0) {
      setErrors(next);
      setPanel(null);

      return;
    }

    const result = compare({ year, incomeEur: incomeEur ?? 0, persons: parsed });

    if (result.ok) {
      setErrors(NO_ERRORS);
      setPanel({ kind: 'comparison', value: result.value });
      // SPEC 15: that somebody compared, and nothing about what.
      track(comparatorCalculated());

      return;
    }

    switch (result.error.code) {
      case 'YEAR_UNAVAILABLE':
        setErrors(NO_ERRORS);
        setPanel({ kind: 'refusal', year: result.error.year });

        return;
      case 'INCOME_INVALID':
        setErrors({ income: COPY.errors.income, persons: {} });
        setPanel(null);

        return;
      case 'BIRTH_YEAR_INVALID': {
        const person = persons[result.error.index];

        setErrors({ persons: person === undefined ? {} : { [person.key]: COPY.errors.birthYear(year) } });
        setPanel(null);

        return;
      }
      case 'NO_PERSON':
        setPanel(null);

        return;
    }
  };

  return (
    <>
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-labelledby={ID.form}>
        <h2 className={styles.formHeading} id={ID.form}>
          {COPY.form.heading}
        </h2>

        <FieldGroup id={ID.year} label={COPY.form.year.label} helper={COPY.form.year.helper}>
          {(control) => (
            <select
              {...control}
              className={styles.select}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {AVAILABLE_YEARS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
        </FieldGroup>

        <FieldGroup
          id={ID.income}
          label={COPY.form.income.label}
          helper={COPY.form.income.helper(year)}
          {...(errors.income === undefined ? {} : { error: errors.income })}
        >
          {(control) => (
            <span className={styles.amountField}>
              <input
                {...control}
                className={styles.input}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={income}
                onChange={(event) => setIncome(event.target.value)}
              />
              <span className={styles.suffix} aria-hidden="true">
                {COPY.form.income.suffix}
              </span>
            </span>
          )}
        </FieldGroup>

        <fieldset className={styles.persons}>
          <legend className={styles.legend}>{COPY.form.persons.legend}</legend>
          <p className={styles.helper}>{COPY.form.persons.helper}</p>

          <ol className={styles.personList}>
            {persons.map((person, index) => {
              const fieldId = ID.birthYear(person.key);
              const accidentId = ID.accident(person.key);
              const error = errors.persons[person.key];

              return (
                <li className={styles.person} key={person.key} data-person={index + 1}>
                  <FieldGroup
                    id={fieldId}
                    label={index === 0 ? COPY.form.persons.you : COPY.form.persons.other(index + 1)}
                    {...(error === undefined ? {} : { error })}
                  >
                    {(control) => (
                      <input
                        {...control}
                        className={`${styles.input} ${styles.yearInput}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={4}
                        value={person.birthYear}
                        onChange={(event) => update(person.key, { birthYear: event.target.value })}
                      />
                    )}
                  </FieldGroup>

                  <div className={styles.checkRow}>
                    <input
                      id={accidentId}
                      className={styles.checkbox}
                      type="checkbox"
                      checked={person.withAccident}
                      onChange={(event) => update(person.key, { withAccident: event.target.checked })}
                      {...(index === 0 ? { 'aria-describedby': `${accidentId}-pourquoi` } : {})}
                    />
                    <label className={styles.checkLabel} htmlFor={accidentId}>
                      {COPY.form.persons.accident}
                    </label>
                  </div>
                  {index === 0 ? (
                    <p className={styles.helper} id={`${accidentId}-pourquoi`}>
                      {COPY.form.persons.accidentDefaultYou}
                    </p>
                  ) : (
                    <button
                      className={styles.removeButton}
                      type="button"
                      onClick={() => remove(person.key)}
                    >
                      <Minus className={styles.buttonIcon} aria-hidden="true" />
                      {COPY.form.persons.remove(index + 1)}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>

          {persons.length < MAX_PERSONS ? (
            <button className={styles.addButton} type="button" onClick={add}>
              <Plus className={styles.buttonIcon} aria-hidden="true" />
              {COPY.form.persons.add}
            </button>
          ) : null}
        </fieldset>

        <button className={styles.submit} type="submit">
          {COPY.form.submit}
        </button>
      </form>

      <div className={styles.result} aria-live="polite" data-result-region="true">
        {panel === null ? null : <ComparisonPanel state={panel} />}
      </div>
    </>
  );
}
