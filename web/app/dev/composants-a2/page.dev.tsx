// web/app/dev/composants-a2/page.dev.tsx
//
// FW-CALCS-A2 (R733): the calculators' shared pieces, on a workbench page of
// their own - the Stepper, the SegmentedChoice, the Chip, the ResultCard in
// both tones, and the comparison panel in its comparison state.
//
// THEIR OWN PAGE, so /dev/composants keeps its HEAD structure and the only
// change on it is the A2 restyle of its two comparison specimens (R207 asked
// what moved six baselines of untouched components). That restyle alone still
// re-antialiases six specimens below it (shell, home counter x2, home FAQ,
// both phones): the comparison section's new height moves everything under it
// by a fraction of a pixel - the diffs sit on rounded corners and glyph edges,
// at most 455 pixels and a channel delta of 27. Three placements were measured
// (in place: 6; the section removed: 5; this page: 6); none moved nothing.
// REPORT-FW-CALCS-A2 lists them for the operator's ruling (R735).
//
// Dev-only, like /dev/composants: compiled with the dev routes, never shipped.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ruleSetFor } from '@/lib/calc-engine';
import { compare } from '@/lib/lamal/compare';
import { DEFAULT_YEAR } from '@/lib/lamal/years';
import { WORKBENCH } from '@/lib/fr/workbench';
import { formatPercent } from '@/lib/ui/core';
import { ComparisonPanel } from '@/lib/ui/react/Comparison/ComparisonPanel';
import { AppCard } from '@/app/(public)/calculateur-teletravail-frontalier/AppCard';
import { CalcsSpecimens } from '../composants/CalcsSpecimens';
import styles from '../composants/page.module.scss';

export const metadata: Metadata = {
  title: WORKBENCH.calcs.title,
  robots: { index: false, follow: false },
};

/**
 * The sample household of R737 (one adult born 1985, 42 000 EUR) for the
 * default year, computed by lib/lamal as the page computes it.
 */
const COMPARISON_SAMPLE = compare({
  year: DEFAULT_YEAR,
  incomeEur: 42000,
  persons: [{ birthYear: 1985, withAccident: false }],
});

/** The year's fiscal ceiling, as the calculator's prose formats it (R147). */
const FISCAL = formatPercent(ruleSetFor(2026).fiscalCeiling * 100, 0);

function Specimen({ id, caption, children }: { readonly id: string; readonly caption: string; readonly children: ReactNode }) {
  return (
    <figure className={styles.specimen} data-testid={id}>
      <figcaption className={styles.caption}>{caption}</figcaption>
      {children}
    </figure>
  );
}

export default function WorkbenchA2Page() {
  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <h1>{WORKBENCH.calcs.title}</h1>
        <CalcsSpecimens fiscal={FISCAL} />
        <div className={styles.stack}>
          <Specimen id="calcs-card-brand" caption={WORKBENCH.calcs.cardBrand}>
            <AppCard />
          </Specimen>
          {COMPARISON_SAMPLE.ok ? (
            <Specimen id="comparison-panel" caption={WORKBENCH.comparison.panel}>
              <ComparisonPanel state={{ kind: 'comparison', value: COMPARISON_SAMPLE.value }} />
            </Specimen>
          ) : null}
        </div>
      </section>
    </main>
  );
}
