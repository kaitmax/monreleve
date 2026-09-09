// web/lib/ui/react/ZoneBadge/ZoneBadge.tsx
//
// The status chip. SPEC 6.2: "Every status carries icon + label + one-line
// explanation, identical on web, Android, and PDF." SPEC 16: never
// colour-only. All three parts are mandatory in all four states.
//
// COLOURS PER RULING R57, which overrides both the FW8 prompt and FD3, on
// measured grounds: #B7791F on #FFF7E6 is 3.42:1 and fails AA for normal
// text. The prompt asked for the chip label in that colour, which would have
// failed the contrast audit demanded in the same task. So:
//
//   label        --colour-text-primary on the soft fill   16.64:1
//   icon         the status colour                        non-text, 3:1 bar
//   explanation  --colour-text-primary on the surface     17.74:1
//
// The status colour survives where it is legal and still carries meaning.
//
// IT TAKES A Status AND NOTHING ELSE. No Zone prop exists, so "coloured by
// Status, never by Zone" is not a rule a caller could break - there is no
// channel. That matters because SPEC 6.2 calls the inverse a review
// rejection, and because mission-exposure is precisely the case where the two
// axes disagree: a warning badge on a green rail.

import { CircleCheck, CircleX, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { ComponentType } from 'react';
import { STATUS_PRESENTATION } from '@/lib/ui/core';
import type { LucideIconName, Status } from '@/lib/ui/core';
import styles from './ZoneBadge.module.scss';

export interface ZoneBadgeProps {
  readonly status: Status;
}

/**
 * The four icons, imported BY NAME. RULING R2, and this cost 207 KiB.
 *
 * This was `import * as icons from 'lucide-react'` with a kebab-to-Pascal
 * lookup at render time - the arrangement zone-tokens.ts predicted at FW6 and
 * which a test guarded for typos. It works, and it defeats tree-shaking
 * completely: a namespace import of an icon library pulls in every icon,
 * because a bundler cannot know which key a runtime string will select.
 *
 * IT HID FOR FOUR TASKS because ZoneBadge only ever rendered on
 * /dev/composants, which check-budgets.mjs reports as "not gated". FW12 put
 * it on the calculator, and GATE A went from 116,3 KiB to 323,1 - a breach
 * of 198 KiB against a 125 KiB ceiling. The budget gate caught, on its first
 * exposure, a defect that had been latent since FW8.
 *
 * A STATIC MAP, so the bundler sees four named imports and nothing else. It
 * is keyed by LucideIconName, so a name added to STATUS_VISUAL without an
 * import here is a compile error - a stronger guarantee than the string
 * lookup had, since that one could only be checked by a test at runtime.
 */
const ICONS = {
  'circle-check': CircleCheck,
  'triangle-alert': TriangleAlert,
  'circle-x': CircleX,
  'octagon-alert': OctagonAlert,
} satisfies Record<LucideIconName, ComponentType>;

export function ZoneBadge({ status }: ZoneBadgeProps) {
  const { label, explanation, icon, colourToken, softColourToken } = STATUS_PRESENTATION[status];
  const Icon = ICONS[icon];

  return (
    <div className={styles.root}>
      <span
        className={styles.chip}
        style={{ backgroundColor: `var(${softColourToken})` }}
        data-status={status}
      >
        {/* The glyph is decorative: the label beside it says the same thing
            in words, and SPEC 16 requires the words. Announcing both would
            read the status twice. */}
        {/*
          NO LONGER CONDITIONAL. The old lookup could return undefined for a
          mistyped name, so the render had to cope; ICONS is exhaustive over
          LucideIconName, so there is no absent case to handle and a missing
          entry cannot compile.
        */}
        <span className={styles.icon} style={{ color: `var(${colourToken})` }} aria-hidden="true">
          <Icon />
        </span>
        {label}
      </span>
      <p className={styles.explanation}>{explanation}</p>
    </div>
  );
}
