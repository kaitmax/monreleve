// web/app/dev/composants/CalcsSpecimens.tsx
//
// FW-CALCS-A2 (R733): the shared pieces of both calculators on the
// workbench, in every state - the Stepper (plain, and inside a field in
// error), the SegmentedChoice (each of two options selected, and three
// options), the Chip (checked and not), the ResultCard (surface, brand).
//
// A CLIENT FILE because the controls take handlers, and the workbench page is
// a server component. Dev-only: nothing here ships to a public route. The
// words are the calculator's own (CALCULATEUR_COPY), so each specimen shows
// the control as a reader meets it; the captions are the workbench's.

'use client';

import { type ReactNode, useState } from 'react';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { WORKBENCH } from '@/lib/fr/workbench';
import { Chip } from '@/lib/ui/react/Chip/Chip';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import { ResultCard } from '@/lib/ui/react/ResultCard/ResultCard';
import { SegmentedButtons } from '@/lib/ui/react/SegmentedButtons/SegmentedButtons';
import { SegmentedChoice } from '@/lib/ui/react/SegmentedChoice/SegmentedChoice';
import { Stepper } from '@/lib/ui/react/Stepper/Stepper';
import styles from './page.module.scss';

const FORM = CALCULATEUR_COPY.form;
const DAYS = CALCULATEUR_COPY.projection.days;
const C = WORKBENCH.calcs;

/** A numeric field the stepper moves by half a day, as the calculator's does. */
function StepperSpecimen({ id, error }: { readonly id: string; readonly error?: string }) {
  const [value, setValue] = useState('12');
  const step = (delta: number) => {
    setValue((current) => String(Math.max(0, Number(current) + delta)));
  };

  return (
    <FieldGroup id={id} label={FORM.days.label} {...(error === undefined ? {} : { error })}>
      {(control) => (
        <Stepper
          decreaseLabel={FORM.days.decrease}
          increaseLabel={FORM.days.increase}
          onDecrease={() => {
            step(-0.5);
          }}
          onIncrease={() => {
            step(0.5);
          }}
        >
          <input
            {...control}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </Stepper>
      )}
    </FieldGroup>
  );
}

/** The workbench's own figure, as page.dev.tsx's Specimen draws it. */
function Figure({ id, caption, children }: { readonly id: string; readonly caption: string; readonly children: ReactNode }) {
  return (
    <figure className={styles.specimen} data-testid={id}>
      <figcaption className={styles.caption}>{caption}</figcaption>
      {children}
    </figure>
  );
}

function ToggleSpecimen({
  name,
  initial,
  fiscal,
}: {
  readonly name: string;
  readonly initial: string;
  readonly fiscal: string;
}) {
  const [value, setValue] = useState(initial);

  return (
    <SegmentedChoice
      name={name}
      legend={FORM.missions.question}
      helper={FORM.missions.helper(fiscal)}
      options={[
        { value: FORM.missions.no, label: FORM.missions.no },
        { value: FORM.missions.yes, label: FORM.missions.yes },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}

/** fiscal: the year's ceiling, formatted by the server page from the RuleSet (R147). */
export function CalcsSpecimens({ fiscal }: { readonly fiscal: string }) {
  const [decompte, setDecompte] = useState('dj');
  const [buttons, setButtons] = useState<string>(FORM.missions.yes);
  const [days, setDays] = useState<Readonly<Record<string, boolean>>>({ TUESDAY: true, THURSDAY: true });

  return (
    <div className={styles.stack}>
      <Figure id="calcs-stepper" caption={C.stepper}>
        <StepperSpecimen id="wb-stepper" />
      </Figure>
      <Figure id="calcs-stepper-error" caption={C.stepperError}>
        <StepperSpecimen id="wb-stepper-error" error={CALCULATEUR_COPY.result.stale} />
      </Figure>
      <Figure id="calcs-toggle-first" caption={C.toggleFirst}>
        <ToggleSpecimen name="wb-toggle-first" initial={FORM.missions.no} fiscal={fiscal} />
      </Figure>
      <Figure id="calcs-toggle-second" caption={C.toggleSecond}>
        <ToggleSpecimen name="wb-toggle-second" initial={FORM.missions.yes} fiscal={fiscal} />
      </Figure>
      <Figure id="calcs-toggle-three" caption={C.toggleThree}>
        <SegmentedChoice
          name="wb-decompte"
          legend={FORM.decompte.label}
          helper={FORM.decompte.helper}
          options={[
            { value: 'j', label: FORM.decompte.day },
            { value: 'dj', label: FORM.decompte.halfDay },
            { value: 'h', label: FORM.decompte.hours },
          ]}
          value={decompte}
          onChange={setDecompte}
        />
      </Figure>
      <Figure id="calcs-buttons" caption={C.buttons}>
        <SegmentedButtons
          id="wb-buttons"
          legend={FORM.missions.question}
          options={[
            { value: FORM.missions.no, label: FORM.missions.no },
            { value: FORM.missions.yes, label: FORM.missions.yes },
          ]}
          value={buttons}
          onChange={setButtons}
        />
      </Figure>
      <Figure id="calcs-chips" caption={C.chips}>
        <div className={styles.chipRow}>
          {(Object.keys(DAYS) as (keyof typeof DAYS)[]).map((day) => (
            <Chip
              key={day}
              name="wb-rythme"
              value={day}
              label={DAYS[day]}
              checked={days[day] === true}
              onChange={(event) => {
                const { checked } = event.target;

                setDays((current) => ({ ...current, [day]: checked }));
              }}
            />
          ))}
        </div>
      </Figure>
      <Figure id="calcs-card-surface" caption={C.cardSurface}>
        <ResultCard>
          <p>{CALCULATEUR_COPY.result.empty}</p>
        </ResultCard>
      </Figure>
    </div>
  );
}
