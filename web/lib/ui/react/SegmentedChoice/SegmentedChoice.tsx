// web/lib/ui/react/SegmentedChoice/SegmentedChoice.tsx
//
// FW-CALCS-A2, R733: the two-option toggle - "Non | Oui", "Base simplifiee |
// Decompte exact" - drawn as segments (calculateur-a2's design).
//
// IT IS A RADIO GROUP, AND STAYS ONE. The design draws buttons with
// aria-pressed; the calculator's choices are radios inside a GET form, and
// their `name`s (missions, methode, decompte) are SPEC 9.4's parameters - a
// button submits nothing, so a reader without JavaScript would lose the
// answer. So each segment is a real <input type="radio"> stretched over its
// label at zero opacity: it keeps its name, its checked state, the arrow keys
// between options and its accessible name; only the paint is the design's.
//
// A fieldset and its legend name the group (a <label for> pointing at a
// fieldset is inert - CalculatorForm's RadioGroup note, which this replaces).
// The helper is tied to the group by aria-describedby.
//
// Selected is never colour alone: the selected segment is FILLED, the others
// are not - a difference of shape and luminance, and the radio's checked
// state is what assistive technology reads.

import styles from './SegmentedChoice.module.scss';

export interface SegmentedChoiceOption {
  readonly value: string;
  readonly label: string;
}

export interface SegmentedChoiceProps {
  /** The radios' shared name - a SPEC 9.4 parameter where the form is a GET form. */
  readonly name: string;
  readonly legend: string;
  readonly helper?: string;
  readonly options: readonly SegmentedChoiceOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function SegmentedChoice({ name, legend, helper, options, value, onChange }: SegmentedChoiceProps) {
  const helperId = `${name}-helper`;

  return (
    <fieldset className={styles.root} {...(helper === undefined ? {} : { 'aria-describedby': helperId })}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.segments}>
        {options.map((option) => (
          <label className={styles.segment} key={option.value}>
            <input
              className={styles.input}
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
      {helper === undefined ? null : (
        <p className={styles.helper} id={helperId}>
          {helper}
        </p>
      )}
    </fieldset>
  );
}
