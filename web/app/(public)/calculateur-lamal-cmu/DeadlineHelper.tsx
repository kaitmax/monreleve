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
// FW-DELAI-RAPPEL, R918: THE REMINDER FORM, under the helper as the design
// draws it, once a date is computed. What it sends is the address the reader
// types and the COMPUTED end date - never a date they retype - and nothing
// else from this page: the event, its date, the incomes and the household
// stay here (R750; e2e/rappel-delai.spec.ts reads the request body). The
// server keeps the two, for one reminder, and deletes them (R919).
//
// R916, THE CONSERVATIVE CHOICE, KEPT BY R1000: no form for a date fewer than
// fourteen days away, so no mail is ever sent for one - and R1004: none for a
// date too far ahead either. Where the form would be, ONE SENTENCE SAYS WHY
// (R225, asserted on the rendered page). "Today" here is the reader's own
// calendar day; the server refuses on Paris's, and its refusal is shown.
//
// R750, ZERO STORAGE for everything else: the select and the date carry no
// `name` and sit in no submittable container; the day typed reaches no URL,
// log, analytics event or storage. The reminder's controls carry no `name`
// either, so even a native submission could send nothing. No default date:
// today's would come from the clock, and a page that renders the clock cannot
// be photographed the same way twice.

'use client';

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { optionPeriodEnd } from '@/lib/lamal/deadline';
import { LAMAL_COPY as COPY } from '@/lib/fr/lamal';
import { RAPPEL_FORM_COPY } from '@/lib/fr/rappel-form';
import { REMINDER_ENDPOINT, REMINDER_STATUS, isFieldStatus } from '@/lib/rappel/status';
import { localDay, reminderWindow } from '@/lib/rappel/window';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import { ResultCard } from '@/lib/ui/react/ResultCard/ResultCard';
import styles from './comparateur.module.scss';

/** FIXED IDS, like the form's: the specs address the fields by them. */
export const DEADLINE_ID = {
  heading: 'votre-delai',
  event: 'evenement-option',
  date: 'date-evenement',
  email: 'rappel-email',
} as const;

/** The server's answer, narrowed: anything else reads as no answer. */
function readAnswer(body: unknown): { status: string; message: string } | undefined {
  if (typeof body !== 'object' || body === null) return undefined;

  const { status, message } = body as Record<string, unknown>;

  return typeof status === 'string' && typeof message === 'string' ? { status, message } : undefined;
}

export function DeadlineHelper() {
  const [choice, setChoice] = useState(0);
  const [date, setDate] = useState('');
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState<{ readonly for: string; readonly message: string }>();
  const [pending, setPending] = useState(false);
  const end = optionPeriodEnd(date);
  const standing = end === undefined ? undefined : reminderWindow(end, localDay());
  // `end !== undefined` restated so TypeScript narrows `end` wherever `offered` holds.
  const offered = end !== undefined && standing === 'offered';
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

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (end === undefined || pending) return;

    setPending(true);
    setFieldError(undefined);
    setFormError(undefined);

    let answer: { status: string; message: string } | undefined;

    try {
      // THE WHOLE REQUEST: the address and the computed date, form-encoded,
      // to a path with no query. Nothing else from the page is in it (R750).
      const response = await fetch(REMINDER_ENDPOINT, {
        method: 'POST',
        body: new URLSearchParams({ email, date: end }),
      });

      answer = readAnswer(await response.json());
    } catch {
      answer = undefined;
    }

    setPending(false);

    if (answer === undefined) {
      setFormError(RAPPEL_FORM_COPY.offline);
    } else if (answer.status === REMINDER_STATUS.ok) {
      setSent({ for: end, message: answer.message });
    } else if (isFieldStatus(answer.status)) {
      setFieldError(answer.message);
    } else {
      setFormError(answer.message);
    }
  }

  return (
    <div className={styles.deadlineColumn}>
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

      {/*
        R225: once the server has answered "ok" for THIS date, its sentence
        replaces the form - asserted present on the rendered page. A changed
        date brings the form back, since the answer was about the other one.
      */}
      {offered && sent?.for === end ? (
        <p className={styles.reminderSent} role="status" data-reminder-sent="true">
          {sent.message}
        </p>
      ) : offered ? (
        <form className={styles.reminder} noValidate onSubmit={submit} data-reminder-form="true">
          <div className={styles.reminderField}>
            <FieldGroup id={DEADLINE_ID.email} label={RAPPEL_FORM_COPY.label} {...(fieldError === undefined ? {} : { error: fieldError })}>
              {(control) => (
                <input
                  {...control}
                  autoComplete="email"
                  className={styles.input}
                  inputMode="email"
                  // type="text", as the alert card's: the server validates, in
                  // one French sentence, rather than the browser in its own.
                  type="text"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
            </FieldGroup>
          </div>
          <button className={styles.submit} disabled={pending} type="submit">
            {RAPPEL_FORM_COPY.submit}
          </button>
          {formError === undefined ? null : (
            <p className={styles.reminderError} role="alert">
              {formError}
            </p>
          )}
          <p className={styles.reminderHint}>{RAPPEL_FORM_COPY.hint}</p>
        </form>
      ) : standing === 'too-close' || standing === 'too-far' ? (
        // R1000 / R1004: why there is no form, in the box the form would use.
        <p className={styles.reminderSent} role="status" data-reminder-refused={standing}>
          {standing === 'too-close' ? RAPPEL_FORM_COPY.tooClose : RAPPEL_FORM_COPY.tooFar}
        </p>
      ) : null}
    </div>
  );
}
