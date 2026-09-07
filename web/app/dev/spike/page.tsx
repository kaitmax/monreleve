// web/app/dev/spike/page.tsx
//
// ==========================================================================
// SPIKE QUALITY. NOT A COMPONENT LIBRARY.
//
// Everything under app/dev/spike/ exists to be weighed, not to be reused. It
// is deliberately minimal, styled only through tokens, and has no tests
// beyond a render smoke. The real components are lib/ui/react, built in
// FW8-FW9. Nothing outside this directory may import from here - enforced in
// eslint.config.mjs, not just asked for.
// ==========================================================================

import type { Metadata } from 'next';
import { Calculator, CalendarDays, FileText, Info, Smartphone, TriangleAlert } from 'lucide-react';
import { SPIKE } from '@/lib/fr/spike';
import { SpikeForm } from './SpikeForm';
import styles from './spike.module.scss';

const ICON = 20;
const STROKE = 1.75;

export const metadata: Metadata = {
  title: SPIKE.title,
  robots: { index: false, follow: false },
};

export default function SpikePage() {
  return (
    <>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <span className={styles.navItem}>
            <Calculator size={ICON} strokeWidth={STROKE} aria-hidden />
            {SPIKE.nav.calculateur}
          </span>
          <span className={styles.navItem}>
            <FileText size={ICON} strokeWidth={STROKE} aria-hidden />
            {SPIKE.nav.guides}
          </span>
          <span className={styles.navItem}>
            <CalendarDays size={ICON} strokeWidth={STROKE} aria-hidden />
            {SPIKE.nav.releve}
          </span>
          <span className={styles.navItem}>
            <Smartphone size={ICON} strokeWidth={STROKE} aria-hidden />
            {SPIKE.nav.application}
          </span>
        </nav>
        <button type="button" className={styles.primary}>
          {SPIKE.nav.cta}
        </button>
      </header>

      <main className={styles.page}>
        <h1 className={styles.title}>{SPIKE.title}</h1>
        <p className={styles.intro}>{SPIKE.intro}</p>

        <SpikeForm />

        <div className={styles.banner}>
          <TriangleAlert size={ICON} strokeWidth={STROKE} aria-hidden />
          <div>
            <p className={styles.bannerTitle}>{SPIKE.banner.title}</p>
            <p className={styles.bannerBody}>{SPIKE.banner.body}</p>
          </div>
        </div>

        <table className={styles.table}>
          <caption className={styles.caption}>{SPIKE.table.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{SPIKE.table.month}</th>
              <th scope="col">{SPIKE.table.worked}</th>
              <th scope="col">{SPIKE.table.telework}</th>
              <th scope="col">{SPIKE.table.rate}</th>
            </tr>
          </thead>
          <tbody>
            {SPIKE.table.rows.map((row) => (
              <tr key={row.month}>
                <th scope="row">{row.month}</th>
                <td className="u-tnum">{row.worked}</td>
                <td className="u-tnum">{row.telework}</td>
                <td className="u-tnum">{row.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className={styles.notice}>
          <Info size={ICON} strokeWidth={STROKE} aria-hidden />
          <span>{SPIKE.notice}</span>
        </p>
      </main>
    </>
  );
}
