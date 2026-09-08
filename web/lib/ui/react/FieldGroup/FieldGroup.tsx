// web/lib/ui/react/FieldGroup/FieldGroup.tsx
//
// A label, a control, its hint and its error - wired together correctly.
//
// THE WIRING IS THE COMPONENT. Rendering the three pieces of text is easy;
// what every hand-rolled form gets wrong is that the CONTROL has to carry
// aria-describedby pointing at whichever of hint and error exist,
// aria-invalid when there is an error, and a hook the stylesheet can use for
// the 2 px error border. Miss one and the field looks right and announces
// wrong, which is the defect a sighted reviewer cannot see.
//
// SO children IS A FUNCTION. "Composition, not a props bag" is the
// instruction, and a function looks like neither until you try the
// alternatives:
//
//   a plain slot     FieldGroup would have to reach into an element it does
//                    not own (React.cloneElement) and assume the child
//                    accepts aria-describedby. Untypeable, and silently wrong
//                    for a fragment or a wrapped child.
//   a props bag      FieldGroup would take `inputProps` and render the
//                    control itself, which fixes the control to <input> and
//                    breaks on the first select or radio group.
//   documentation    "the caller must set these four attributes" makes the
//                    guarantee a convention, and replacing that convention is
//                    the entire reason this component exists.
//
// The function receives exactly the attributes the control must carry and
// nothing else. The caller still decides what the control IS. The props go
// TO the caller rather than coming from it, and that direction is what makes
// them provable: every test asserts on the real <input> the caller rendered.
//
// IDS ARE DERIVED FROM THE CALLER'S id, not from a counter or useId. Two
// instances cannot collide, the ids are stable across re-renders, and the
// server and client render the same string - which useId does not guarantee
// to be readable or diffable, and a counter does not guarantee at all.

import { CircleAlert } from 'lucide-react';
import styles from './FieldGroup.module.scss';

/**
 * Exactly what the control must carry. Spread it onto the control and the
 * field is wired; the type is the checklist.
 *
 * The optional members are `undefined` rather than `false` when absent
 * because React omits an attribute for undefined and renders
 * aria-invalid="false" for false - and "explicitly not invalid" is a
 * different statement from "no claim made", which matters to a screen reader
 * encountering a field the user has not touched.
 */
export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': true | undefined;
  readonly 'data-invalid': true | undefined;
}

export interface FieldGroupProps {
  /** The control's id. Every other id on this field is derived from it. */
  readonly id: string;
  readonly label: string;
  readonly helper?: string;
  /** Already-French text, from lib/fr/errors.ts via errorMessage. */
  readonly error?: string;
  readonly children: (control: FieldControlProps) => React.ReactNode;
}

export function FieldGroup({ id, label, helper, error, children }: FieldGroupProps) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  // DOM order, so that what is heard and what is seen agree. Filtered rather
  // than joined blindly: aria-describedby="" points at nothing, and some
  // screen readers announce that as a broken reference rather than as no
  // description at all.
  const described = [helper === undefined ? '' : helperId, error === undefined ? '' : errorId]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.root}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>

      {children({
        id,
        'aria-describedby': described === '' ? undefined : described,
        'aria-invalid': error === undefined ? undefined : true,
        'data-invalid': error === undefined ? undefined : true,
      })}

      {helper === undefined ? null : (
        <p className={styles.helper} id={helperId}>
          {helper}
        </p>
      )}

      {error === undefined ? null : (
        // role="alert" because the message appears after the user has acted.
        // A message that is visually obvious and silent to a screen reader is
        // the classic form defect, and it is invisible to a sighted review.
        <p className={styles.error} id={errorId} role="alert">
          {/* The words carry the meaning (SPEC 16, never colour-only); the
              glyph is the second channel, so announcing it would say the same
              thing twice. */}
          <CircleAlert className={styles.errorIcon} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
