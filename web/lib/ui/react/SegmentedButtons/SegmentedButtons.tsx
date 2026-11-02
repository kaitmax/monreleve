// web/lib/ui/react/SegmentedButtons/SegmentedButtons.tsx
//
// FW-CALCS-A2, R750: the two-option toggle WITHOUT A NAME, for the LAMal
// comparator ("Individuelle | Commune", "Toute l'annee | A partir d'une
// date"). Nothing a reader types or picks there may reach a native
// submission, a URL or a log, and a radio without a name is not a group (the
// single selection and the arrow keys come from the shared name). So the
// segments are <button type="button" aria-pressed>: the same fieldset and
// legend and the same paint as SegmentedChoice (the calculator's named
// radios), a pressed state assistive technology reads, a type that never
// submits the form around it.
//
// ITS OWN COMPONENT AND STYLESHEET, NOT A MODE OF SegmentedChoice (R736):
// shared by the two routes, one module became a split chunk and the
// calculator - 0.1 KiB of first-load headroom - went over GATE A. Kept apart,
// the calculator ships none of this. The look is SegmentedChoice's, token for
// token (SegmentedButtons.module.scss says which rules).

import styles from './SegmentedButtons.module.scss';

export interface SegmentedButtonsOption {
  readonly value: string;
  readonly label: string;
}

export interface SegmentedButtonsProps {
  /** The group's id, from which the helper's id derives. */
  readonly id: string;
  readonly legend: string;
  readonly helper?: string;
  readonly options: readonly SegmentedButtonsOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function SegmentedButtons({ id, legend, helper, options, value, onChange }: SegmentedButtonsProps) {
  const helperId = `${id}-helper`;

  return (
    <fieldset className={styles.root} {...(helper === undefined ? {} : { 'aria-describedby': helperId })}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.segments}>
        {options.map((option) => (
          <button
            className={styles.segment}
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => {
              onChange(option.value);
            }}
          >
            {option.label}
          </button>
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
