// web/lib/ui/react/Chip/Chip.tsx
//
// FW-CALCS-A2, R733: the chip - one day of the week the reader usually
// teleworks from (calculateur-a2's "Lundi ... Vendredi").
//
// A REAL CHECKBOX UNDER THE PAINT, for SegmentedChoice's reason. The rhythm's
// five boxes share the name `rythme` and the browser submits each checked one
// as `?rythme=ma&rythme=je` - SPEC 9.4's repeated parameter, which is what
// lets the question work with JavaScript off (R343). A button with
// aria-pressed would submit nothing. So the input is stretched over the chip
// at zero opacity: its name, value, checked state and accessible name are the
// control's; the chip is how it looks.
//
// Checked is never colour alone: a checked chip is FILLED, an unchecked one is
// an outline.

import type { ChangeEvent } from 'react';
import styles from './Chip.module.scss';

export interface ChipProps {
  readonly name: string;
  readonly value: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function Chip({ name, value, label, checked, onChange }: ChipProps) {
  return (
    <label className={styles.chip}>
      <input
        className={styles.input}
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}
