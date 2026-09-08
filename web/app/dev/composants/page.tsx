// web/app/dev/composants/page.tsx
// The workbench: every component, every state. No Storybook (SPEC section 4).
//
// Every specimen carries a data-testid, because this page is what the
// Playwright passes drive: the computed-style checks that only a real browser
// can answer (AC3's tabular figures), the screenshot baselines, and the axe
// sweep. Those ids are the contract between this page and e2e/.
//
// Noindex and out of the sitemap. It is not a public route and is excluded
// from the R2 gates for that reason; `pnpm size` reports it separately.

import type { Metadata } from 'next';
import { WORKBENCH_TITLE } from '@/lib/fr';
import { WORKBENCH } from '@/lib/fr/workbench';
import { RateDisplay } from '@/lib/ui/react/RateDisplay/RateDisplay';
import styles from './page.module.scss';

export const metadata: Metadata = {
  title: WORKBENCH_TITLE,
  robots: { index: false, follow: false },
};

// Geneva case (c): 39,16 % declarable against 45,0 % of days outside
// Switzerland. The fixture the two-rate rule exists for (SPEC 9.3).
const GENEVA_C = { declarable: 39.16, raw: 45 };

export default function WorkbenchPage() {
  return (
    <main className={styles.page}>
      <h1>{WORKBENCH_TITLE}</h1>
      <p className={styles.intro}>{WORKBENCH.intro}</p>

      <section className={styles.section}>
        <h2>{WORKBENCH.rateDisplay.title}</h2>

        <div className={styles.specimens}>
          <figure className={styles.specimen} data-testid="rate-compliant">
            <figcaption className={styles.caption}>
              {WORKBENCH.rateDisplay.compliant}
            </figcaption>
            <RateDisplay declarableRate={22.4} zone="compliant" />
          </figure>

          <figure className={styles.specimen} data-testid="rate-exposure">
            <figcaption className={styles.caption}>
              {WORKBENCH.rateDisplay.exposure}
            </figcaption>
            <RateDisplay declarableRate={44.8} zone="fiscal-exposure" />
          </figure>

          <figure className={styles.specimen} data-testid="rate-social">
            <figcaption className={styles.caption}>
              {WORKBENCH.rateDisplay.social}
            </figcaption>
            <RateDisplay declarableRate={52.3} zone="social-switch" />
          </figure>

          <figure className={styles.specimen} data-testid="rate-divergent">
            <figcaption className={styles.caption}>
              {WORKBENCH.rateDisplay.divergent}
            </figcaption>
            <RateDisplay
              declarableRate={GENEVA_C.declarable}
              zone="compliant"
              rawRate={GENEVA_C.raw}
            />
          </figure>
        </div>
      </section>
    </main>
  );
}
