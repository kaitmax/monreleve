// web/app/(public)/calculateur-lamal-cmu/DeadlineHelper.tsx
//
// FW-CALCS-A2, R748: "Votre délai" - the event that opens the three-month
// option period, its date, and the three steps filled in from them.
//
// S3 IS NOT FOUND (docs/sources/primes-lamal/sources-2026-11.md): no text
// says exactly how the three months are counted. So the end date is
// lib/lamal/deadline.ts's one stated way of counting - the event's date plus
// three calendar months, clamped to the month's end - shown with « environ »,
// and the warning to confirm with the fund is always there (R748: it stays
// whatever S3 later says).
//
// THE EVENTS ARE THE BANNER'S FOUR (rows D1-D6), read from the same list in
// lib/fr/lamal.ts the banner's sentence is built from (R206).
//
// R749: NO REMINDER E-MAIL. The design draws one; it is parked as its own
// task (FW-DELAI-RAPPEL), because sending one later means storing an address
// and a date. This helper stores nothing.
//
// R750, ZERO STORAGE: the select and the date carry no `name` and sit in no
// submittable container; the day typed reaches no URL, log, analytics event
// or storage. No default date: today's would come from the clock, and a page
// that renders the clock cannot be photographed the same way twice.

'use client';

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { optionPeriodEnd } from '@/lib/lamal/deadline';
import { LAMAL_COPY as COPY } from '@/lib/fr/lamal';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import { ResultCard } from '@/lib/ui/react/ResultCard/ResultCard';
import styles from './comparateur.module.scss';

/** FIXED IDS, like the form's: the specs address the fields by them. */
export const DEADLINE_ID = {
  heading: 'votre-delai',
  event: 'evenement-option',
  date: 'date-evenement',
} as const;

export function DeadlineHelper() {
  const [choice, setChoice] = useState(0);
  const [date, setDate] = useState('');
  const end = optionPeriodEnd(date);
  const steps = [
    <>
      <strong>
        {end === undefined ? COPY.deadline.startLeadEmpty : COPY.deadline.startLead(COPY.deadline.longDate(date))}
      </strong>{' '}
      {COPY.deadline.startRest(choice)}
    </>,
    <>
      {COPY.deadline.choose}{' '}
      <strong data-deadline-end={end ?? ''}>
        {end === undefined ? COPY.deadline.untilEmpty : COPY.deadline.until(COPY.deadline.longDate(end))}
      </strong>
    </>,
    <>{COPY.deadline.office}</>,
  ];

  return (
    <ResultCard element="section" aria-labelledby={DEADLINE_ID.heading} data-deadline-helper="true">
      <h3 className={styles.deadlineHelperHeading} id={DEADLINE_ID.heading}>
        {COPY.deadline.helperHeading}
      </h3>

      <div className={styles.deadlineFields}>
        <FieldGroup id={DEADLINE_ID.event} label={COPY.deadline.event}>
          {(control) => (
            <select
              {...control}
              className={styles.select}
              value={choice}
              onChange={(event) => setChoice(Number(event.target.value))}
            >
              {COPY.deadline.choices.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </FieldGroup>
        <FieldGroup id={DEADLINE_ID.date} label={COPY.deadline.date}>
          {(control) => (
            <input
              {...control}
              className={`${styles.input} ${styles.dateInput}`}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          )}
        </FieldGroup>
      </div>

      <ol className={styles.steps} aria-label={COPY.deadline.stepsLabel}>
        {steps.map((step, index) => (
          // A fixed list of three; the position is the step.
          <li className={styles.step} key={index}>
            <span className={styles.stepNumber} aria-hidden="true">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className={styles.deadlineWarning}>
        <TriangleAlert className={styles.deadlineGlyph} aria-hidden="true" />
        <span data-deadline-warning="true">{COPY.deadline.warning}</span>
      </p>
    </ResultCard>
  );
}
