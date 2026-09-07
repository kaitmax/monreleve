// web/app/dev/spike/SpikeForm.tsx
//
// SPIKE QUALITY. NOT A COMPONENT LIBRARY. See page.tsx.
//
// This is the client island: the form card, the stepper, the accordion and the
// sheet-style panel. It exists as a client component on purpose. FW11's
// calculator recomputes live and FW12's result panel is interactive, so the
// weight a real public page pays is the weight of an island like this one -
// measuring only Server Components would flatter the budget.

'use client';

import { useState } from 'react';
import { Check, ChevronDown, Download, Minus, Plus, X } from 'lucide-react';
import { SPIKE } from '@/lib/fr/spike';
import styles from './spike.module.scss';

const ICON = 20;
const STROKE = 1.75;

export function SpikeForm() {
  const [days, setDays] = useState(8);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [contract, setContract] = useState('full');

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{SPIKE.form.legend}</h2>

      <label className={styles.field}>
        <span className={styles.label}>{SPIKE.form.canton}</span>
        <select className={styles.select} defaultValue={SPIKE.form.cantonOptions[0]}>
          {SPIKE.form.cantonOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.field}>
        <span className={styles.label}>{SPIKE.form.teleworkDays}</span>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.stepperButton}
            aria-label={SPIKE.form.decrease}
            onClick={() => setDays((value) => Math.max(0, value - 1))}
          >
            <Minus size={ICON} strokeWidth={STROKE} aria-hidden />
          </button>
          <output className={styles.stepperValue}>{days}</output>
          <button
            type="button"
            className={styles.stepperButton}
            aria-label={SPIKE.form.increase}
            onClick={() => setDays((value) => value + 1)}
          >
            <Plus size={ICON} strokeWidth={STROKE} aria-hidden />
          </button>
        </div>
      </div>

      <fieldset className={styles.field}>
        <legend className={styles.label}>{SPIKE.form.contract}</legend>
        <label className={styles.radioRow}>
          <input
            type="radio"
            name="contract"
            value="full"
            checked={contract === 'full'}
            onChange={() => setContract('full')}
          />
          <span>{SPIKE.form.fullTime}</span>
        </label>
        <label className={styles.radioRow}>
          <input
            type="radio"
            name="contract"
            value="part"
            checked={contract === 'part'}
            onChange={() => setContract('part')}
          />
          <span>{SPIKE.form.partTime}</span>
        </label>
      </fieldset>

      <div className={styles.accordion}>
        <button
          type="button"
          className={styles.accordionHeader}
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <span>{SPIKE.form.details}</span>
          <ChevronDown
            size={ICON}
            strokeWidth={STROKE}
            aria-hidden
            className={detailsOpen ? styles.chevronOpen : styles.chevron}
          />
        </button>
        {detailsOpen ? <p className={styles.accordionBody}>{SPIKE.form.detailsBody}</p> : null}
      </div>

      <button type="button" className={styles.secondary} onClick={() => setPanelOpen(true)}>
        <Download size={ICON} strokeWidth={STROKE} aria-hidden />
        <span>{SPIKE.panel.title}</span>
      </button>

      {panelOpen ? (
        <div className={styles.sheet}>
          <div className={styles.sheetGrip} />
          <h3 className={styles.cardTitle}>{SPIKE.panel.title}</h3>
          <p className={styles.sheetBody}>{SPIKE.panel.body}</p>
          <div className={styles.sheetActions}>
            <button type="button" className={styles.primary} onClick={() => setPanelOpen(false)}>
              <Check size={ICON} strokeWidth={STROKE} aria-hidden />
              <span>{SPIKE.panel.confirm}</span>
            </button>
            <button type="button" className={styles.secondary} onClick={() => setPanelOpen(false)}>
              <X size={ICON} strokeWidth={STROKE} aria-hidden />
              <span>{SPIKE.panel.cancel}</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
