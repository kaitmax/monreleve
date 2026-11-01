// web/lib/ui/react/Stepper/Stepper.tsx
//
// FW-CALCS-A2, R733: the stepper - a number field between a "minus" and a
// "plus" button, drawn as ONE bordered control (calculateur-a2's design).
//
// IT OWNS NO NUMBER. The caller passes the field itself as children - a text
// input with its own name, value, validation and FieldGroup wiring - and the
// two handlers. So the calculator's arithmetic (its clamp, its half-day step,
// R109's decimal comma) stays where it was tested, and this is styling with a
// shape: the restyle R725 asks for, not a re-implementation.
//
// The buttons carry the caller's accessible names ("Diminuer le taux
// d'activite", "Retirer une demi-journee") and are type="button", so inside a
// GET form they never submit. The icons are decorative; the names say it.

import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import styles from './Stepper.module.scss';

const ICON = 20;
const STROKE = 1.75;

export interface StepperProps {
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
  /** The field: an input the caller owns, with its name and value. */
  readonly children: ReactNode;
}

export function Stepper({ decreaseLabel, increaseLabel, onDecrease, onIncrease, children }: StepperProps) {
  return (
    <div className={styles.root} data-stepper>
      <button type="button" className={styles.step} aria-label={decreaseLabel} onClick={onDecrease}>
        <Minus size={ICON} strokeWidth={STROKE} aria-hidden="true" />
      </button>
      {children}
      <button type="button" className={styles.step} aria-label={increaseLabel} onClick={onIncrease}>
        <Plus size={ICON} strokeWidth={STROKE} aria-hidden="true" />
      </button>
    </div>
  );
}
