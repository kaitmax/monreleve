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

import * as icons from 'lucide-react';
import { STATUS_PRESENTATION } from '@/lib/ui/core';
import type { Status } from '@/lib/ui/core';
import styles from './ZoneBadge.module.scss';

export interface ZoneBadgeProps {
  readonly status: Status;
}

/** 'circle-check' -> 'CircleCheck', which is how lucide-react keys its icons. */
const toPascal = (kebab: string): string =>
  kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/**
 * The kebab-to-Pascal conversion zone-tokens.ts predicted at FW6: "lucide-
 * react keys its icons in PascalCase, so the React layer converts at FW8; a
 * test asserts every name here resolves to a real Lucide icon, because a typo
 * renders an empty badge rather than an error." That test already exists in
 * tests/unit/ui-core/status-presentation.test.ts, so a name that does not
 * resolve fails there before it can render nothing here.
 */
function iconFor(name: string) {
  const registry = icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

  return registry[toPascal(name)];
}

export function ZoneBadge({ status }: ZoneBadgeProps) {
  const { label, explanation, icon, colourToken, softColourToken } = STATUS_PRESENTATION[status];
  const Icon = iconFor(icon);

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
        {Icon ? (
          <span className={styles.icon} style={{ color: `var(${colourToken})` }} aria-hidden="true">
            <Icon />
          </span>
        ) : null}
        {label}
      </span>
      <p className={styles.explanation}>{explanation}</p>
    </div>
  );
}
