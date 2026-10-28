// web/lib/ui/react/HeroPhone/HeroPhone.tsx
//
// A PICTURE OF THE APPLICATION'S Aujourd'hui SCREEN, in two variants (FW-HOME-A2,
// R716): Android before the day is answered, iPhone after.
//
// EXTENDED FROM FW34's HERO PHONE, and moved here from app/(public)/ so the
// workbench can show every state (R722). FW34's card was the engine's result
// in a phone-shaped frame beside the hero; the A2 hero carries the releve
// instead, and the phones move to the application section. What stays is what
// R344 settled: the frame is --size-phone-frame-width and --size-phone-bezel,
// the design's own figures, never a borrowed token.
//
// THE PLATFORM IS THE CUT-OUT, AND NOTHING ELSE. Android has a punch-hole
// camera, the iPhone a pill; each is a named component token (R344). There is
// NO fake status bar - no clock, no battery, no signal - because a status bar
// is a claim about a moment and a device, and this is neither.
//
// THE WORDS ARE THE APP'S (R716). Every label a screen shows comes from
// lib/fr/home.ts's `phone` block, each equal to its Kotlin constant by
// tests/unit/fr/home-copy.test.ts. The figures are the engine's: the rate is
// calculateTelework over lib/content/home.ts's worked example, passed in, and
// the bar is the product's ThresholdRail, so the picture cannot show a figure
// the calculator would not.
//
// ONE IMAGE, ONE NAME. The screen is role="img" with a plain-language label,
// so a screen reader hears "the Aujourd'hui screen, before answering" once
// rather than every label of a screen it cannot use. Everything inside is
// presentation.

import {
  BriefcaseBusiness,
  Building2,
  Calendar,
  CircleCheck,
  FileText,
  House,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { type TeleworkResult, ruleSetFor } from '@/lib/calc-engine';
import { HOME_COPY } from '@/lib/fr/home';
import { formatPercent, zoneFor } from '@/lib/ui/core';
import { ThresholdRail } from '@/lib/ui/react/ThresholdRail/ThresholdRail';
import styles from './HeroPhone.module.scss';

const COPY = HOME_COPY.phone;

/** Lucide's sizes and stroke, DESIGN-SYSTEM section 1: 20 default, 24 large. */
const ICON = 20;
const ICON_LG = 24;
const STROKE = 1.75;

/** The bar's reference width inside the screen; it scales to 100 % below it. */
const RAIL_WIDTH = 232;

/** The four tabs' glyphs, in NavCopy's order. */
const TAB_ICONS = [Sun, Calendar, FileText, SlidersHorizontal] as const;

export interface HeroPhoneProps {
  /** Android: punch-hole camera, the question. iPhone: pill, the answered day. */
  readonly platform: 'android' | 'iphone';
  /** The worked example's result, for the rate card. */
  readonly result: TeleworkResult;
  /** The year, so the bar's ticks are the RuleSet's. */
  readonly taxYear: number;
  /** The fiscal ceiling, formatted, for the rate card's sentence. */
  readonly fiscal: string;
}

export function HeroPhone({ platform, result, taxYear, fiscal }: HeroPhoneProps) {
  const thresholds = ruleSetFor(taxYear);
  const zone = zoneFor(result.declarableRate, thresholds);
  const android = platform === 'android';

  return (
    <figure className={styles.figure} data-platform={platform}>
      <div
        className={styles.frame}
        role="img"
        aria-label={android ? COPY.androidLabel : COPY.iphoneLabel}
      >
        <div className={styles.screen}>
          <div className={styles.cutoutStrip} aria-hidden="true">
            <span className={android ? styles.camera : styles.island} />
          </div>

          <div className={styles.greeting}>
            <p className={styles.hello}>{COPY.greeting}</p>
            <p className={styles.date}>{COPY.date}</p>
          </div>

          {android ? (
            <div className={styles.card}>
              <p className={styles.question}>{COPY.question}</p>
              <div className={styles.choices}>
                <span className={styles.choice}>
                  <Building2 className={styles.choiceIcon} size={ICON} strokeWidth={STROKE} aria-hidden="true" />
                  <span>{COPY.swiss}</span>
                </span>
                <span className={styles.choice}>
                  <House className={styles.choiceIcon} size={ICON} strokeWidth={STROKE} aria-hidden="true" />
                  <span>{COPY.home}</span>
                </span>
                <span className={styles.choice}>
                  <BriefcaseBusiness className={styles.choiceIcon} size={ICON} strokeWidth={STROKE} aria-hidden="true" />
                  <span>{COPY.mission}</span>
                </span>
              </div>
              <p className={styles.textAction}>{COPY.absence}</p>
            </div>
          ) : (
            <div className={styles.card}>
              <p className={styles.cardLabel}>{COPY.tabs[0]}</p>
              <p className={styles.answer}>
                <House className={styles.choiceIcon} size={ICON_LG} strokeWidth={STROKE} aria-hidden="true" />
                <span>{COPY.home}</span>
              </p>
              <p className={styles.recorded}>
                <CircleCheck size={ICON} strokeWidth={STROKE} aria-hidden="true" />
                <span>{COPY.recorded}</span>
              </p>
              <p className={styles.textActionStart}>{COPY.edit}</p>
            </div>
          )}

          <div className={styles.rateCard}>
            <p className={styles.rateLabel}>{COPY.rateLabel}</p>
            <p className={styles.rate}>{formatPercent(result.declarableRate, 2)}</p>
            <ThresholdRail
              percentage={result.declarableRate}
              zone={zone}
              thresholds={thresholds}
              variant="compact"
              width={RAIL_WIDTH}
            />
            <p className={styles.rateLabel}>{COPY.underFiscal(fiscal)}</p>
          </div>

          <div className={styles.spacer} />

          <div className={styles.tabs}>
            {COPY.tabs.map((tab, index) => {
              const TabIcon = TAB_ICONS[index] ?? Sun;

              return (
                <span className={index === 0 ? styles.tabActive : styles.tab} key={tab}>
                  <TabIcon size={ICON_LG} strokeWidth={STROKE} aria-hidden="true" />
                  <span>{tab}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption className={styles.caption}>
        <span className={styles.platformName}>{android ? COPY.androidName : COPY.iphoneName}</span>
        <span className={styles.captionLine}>{android ? COPY.androidLabel : COPY.iphoneLabel}</span>
      </figcaption>
    </figure>
  );
}
