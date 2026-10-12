// web/app/(public)/page.tsx
//
// The home page (FW34), rebuilt from the approved design in design/home. It
// renders INSIDE the public shell (app/(public)/layout.tsx), which supplies the
// header and the footer unchanged (operator Q1: keep FW33's shell), so this
// file is the body between them: hero, calculator, the two rules, how it works,
// the releve, privacy, the app, guides, and the sources strip.
//
// A SERVER COMPONENT, start to finish, and that is the budget guarantee. Every
// section is server-rendered - the Lucide glyphs become static SVG on the
// server, the hero's phone card is the engine's output as HTML - so the page
// adds NO client JavaScript beyond the shell it already had (relay 3, R326).
// Nothing here is 'use client'.
//
// THE FIGURES COME FROM THE ENGINE AND THE RULESET, NEVER TYPED (R147, R163).
// The hero card is calculateTelework() over lib/content/home.ts's worked
// example; the two rules take their thresholds from guideScope(); the guide
// links take their labels from each guide's breadcrumbLabel (R181). A figure
// typed here is refused by tests/unit/fr/typed-numbers.test.ts one layer down.
//
// THE CALCULATOR IS A PLAIN GET FORM to the calculator page's EXISTING params
// (lib/params/schema.ts): canton, tt, mfr. It works with no JavaScript - a
// submit navigates to the calculator with the scenario in the query, which the
// calculator's island reads on mount. No param is invented or renamed (R156).

import type { Metadata } from 'next';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Check,
  EyeOff,
  FileText,
  Gauge,
  Lock,
  Quote,
} from 'lucide-react';
import { calculateTelework } from '@/lib/calc-engine';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { currentTaxYear } from '@/lib/content/tax-year';
import { HERO_EXAMPLE_TELEWORK_DAYS, HOME_GUIDE_SLUGS, heroExampleInput } from '@/lib/content/home';
import { HOME_COPY } from '@/lib/fr/home';
import { CANTONS_BY_NAME } from '@/lib/fr/cantons';
import { guideScope } from '@/lib/guides/scope';
import { publishedGuides } from '@/lib/guides/registry';
import { formatDays } from '@/lib/ui/core';
import { Container } from '@/lib/ui/react/Container/Container';
import { HeroPhone } from './HeroPhone';
import styles from './home.module.scss';

const ICON = 20;
const ICON_SM = 18;
const ICON_STEP = 26;
const ICON_PRIVACY = 28;
const STROKE = 1.75;

/** The calculator page the home form hands off to (its existing route). */
const CALCULATOR_PATH = '/calculateur-teletravail-frontalier';
const ALERTS_PATH = '/alertes';
const GUIDES_PATH = '/guides';
const SOURCES_PATH = '/sources';

// generateMetadata RATHER THAN A CONSTANT, because R147 reaches lib/fr: the
// description names both thresholds and types neither, so they arrive formatted
// from the year's RuleSet through guideScope - the same shape the calculator's
// has. The title stays the layout's default (the bare product name for "/").
export function generateMetadata(): Metadata {
  const { fiscal, social } = guideScope(currentTaxYear());

  return { description: HOME_COPY.description(fiscal, social, PRODUCT_STATE) };
}

export default function HomePage() {
  const year = currentTaxYear();
  const scope = guideScope(year);
  const outcome = calculateTelework(heroExampleInput(year));
  const exampleDays = formatDays(HERO_EXAMPLE_TELEWORK_DAYS);

  // The three guides the Guides section links to, derived from the registry by
  // slug, their labels taken from each guide's own breadcrumbLabel (R181).
  const published = publishedGuides();
  const homeGuides = HOME_GUIDE_SLUGS.map((slug) =>
    published.find((guide) => guide.frontmatter.slug === slug),
  )
    .filter((guide): guide is NonNullable<typeof guide> => guide !== undefined)
    .map((guide) => ({
      label: guide.frontmatter.breadcrumbLabel,
      href: `${GUIDES_PATH}/${guide.frontmatter.slug}`,
    }));

  return (
    <main>
      {/* ---------------------------------------------------------------- HERO */}
      <section className={styles.hero}>
        <Container width="public">
          <div className={styles.heroGrid}>
            <div className={styles.heroText}>
              <span className={styles.eyebrowPill}>{HOME_COPY.hero.eyebrow}</span>
              <h1 className={styles.heroHeading}>{HOME_COPY.hero.heading}</h1>
              <p className={styles.heroLead}>{HOME_COPY.hero.lead}</p>
              <ul className={styles.heroBullets}>
                {HOME_COPY.hero.bullets.map((bullet) => (
                  <li className={styles.heroBullet} key={bullet}>
                    <Check
                      className={styles.bulletIcon}
                      size={ICON}
                      strokeWidth={STROKE}
                      aria-hidden="true"
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.heroActions}>
                <a className={styles.pillPrimary} href="#calcul">
                  {HOME_COPY.hero.ctaPrimary}
                  <ArrowRight size={ICON_SM} strokeWidth={STROKE} aria-hidden="true" />
                </a>
                <a className={styles.pillSecondary} href="#app">
                  {HOME_COPY.hero.ctaSecondary}
                </a>
              </div>
            </div>

            {outcome.ok ? (
              <HeroPhone
                result={outcome.value}
                taxYear={year}
                fiscal={scope.fiscal}
                social={scope.social}
                exampleDays={exampleDays}
                basisDays={scope.basisDays}
              />
            ) : null}
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------- CALCULATOR */}
      <section id="calcul" className={styles.calc}>
        <Container width="public">
          <div className={styles.calcGrid}>
            <div className={styles.calcIntro}>
              <span className={styles.eyebrow}>{HOME_COPY.calculator.eyebrow}</span>
              <h2 className={styles.sectionHeading}>{HOME_COPY.calculator.heading}</h2>
              <p className={styles.lead}>{HOME_COPY.calculator.intro}</p>
              <p className={styles.note}>{HOME_COPY.calculator.note}</p>
            </div>

            {/* A plain GET form to the calculator's existing params. No JS. */}
            <form className={styles.calcCard} method="get" action={CALCULATOR_PATH}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="home-canton">
                  {HOME_COPY.calculator.cantonLabel}
                </label>
                <select
                  id="home-canton"
                  name="canton"
                  className={styles.select}
                  defaultValue="GE"
                >
                  {CANTONS_BY_NAME.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="home-tt">
                    {HOME_COPY.calculator.teleworkLabel}
                  </label>
                  <input
                    id="home-tt"
                    name="tt"
                    type="text"
                    inputMode="numeric"
                    className={styles.input}
                    defaultValue={String(HERO_EXAMPLE_TELEWORK_DAYS)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="home-mfr">
                    {HOME_COPY.calculator.missionsLabel}
                  </label>
                  <input
                    id="home-mfr"
                    name="mfr"
                    type="text"
                    inputMode="numeric"
                    className={styles.input}
                    defaultValue="0"
                  />
                </div>
              </div>

              <button className={styles.pillPrimary} type="submit">
                {HOME_COPY.calculator.submit}
                <ArrowRight size={ICON_SM} strokeWidth={STROKE} aria-hidden="true" />
              </button>
            </form>
          </div>
        </Container>
      </section>

      {/* ----------------------------------------------------------- TWO RULES */}
      <section className={styles.rules}>
        <Container width="public">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>{HOME_COPY.rules.eyebrow}</span>
            <h2 className={styles.sectionHeading}>
              {HOME_COPY.rules.heading(scope.fiscal, scope.social)}
            </h2>
          </div>

          <div className={styles.ruleCards}>
            <div className={styles.ruleCard}>
              <span className={styles.ruleTag}>{HOME_COPY.rules.fiscal.tag}</span>
              <span className={styles.ruleFigure}>{scope.fiscal}</span>
              <p className={styles.ruleBody}>
                {HOME_COPY.rules.fiscal.body(scope.fiscal, scope.missionCap)}
              </p>
              <span className={styles.ruleSource}>{HOME_COPY.rules.fiscal.source}</span>
            </div>

            <div className={styles.ruleCard}>
              <span className={styles.ruleTag}>{HOME_COPY.rules.social.tag}</span>
              <span className={styles.ruleFigure}>{scope.social}</span>
              <p className={styles.ruleBody}>
                {HOME_COPY.rules.social.body(scope.social, scope.a1Threshold)}
              </p>
              <span className={styles.ruleSource}>{HOME_COPY.rules.social.source}</span>
            </div>
          </div>
        </Container>
      </section>

      {/* -------------------------------------------------------- HOW IT WORKS */}
      <section className={styles.how}>
        <Container width="public">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>{HOME_COPY.how.eyebrow}</span>
            <h2 className={styles.sectionHeading}>{HOME_COPY.how.heading}</h2>
          </div>

          <ol className={styles.steps}>
            {HOME_COPY.how.steps.map((step, index) => {
              const StepIcon = [CalendarCheck, Gauge, FileText][index] ?? CalendarCheck;

              return (
                <li className={styles.step} key={step.title}>
                  <div className={styles.stepTop}>
                    <span className={styles.stepNumber}>{String(index + 1)}</span>
                    <StepIcon
                      className={styles.stepIcon}
                      size={ICON_STEP}
                      strokeWidth={STROKE}
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepBody}>{step.body}</p>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* ------------------------------------------------------------- RELEVE */}
      <section className={styles.releve}>
        <Container width="public">
          <div className={styles.releveGrid}>
            <div className={styles.releveThumb} aria-hidden="true">
              <div className={styles.releveThumbHead}>
                <span className={styles.releveWordmark}>{HOME_COPY.releve.sample.title(year)}</span>
              </div>
              <div className={styles.releveRow}>
                <span className={styles.releveHolderLabel}>{HOME_COPY.releve.sample.holderLabel}</span>
                <span className={styles.releveHolderName}>{HOME_COPY.releve.sample.holderName}</span>
              </div>
              <div className={styles.releveBars}>
                <span className={styles.releveBar} style={{ width: '92%' }} />
                <span className={styles.releveBar} style={{ width: '78%' }} />
                <span className={styles.releveBar} style={{ width: '85%' }} />
                <span className={styles.releveBar} style={{ width: '64%' }} />
                <span className={styles.releveBar} style={{ width: '88%' }} />
              </div>
              <div className={styles.releveVerify}>
                <svg
                  className={styles.releveQr}
                  viewBox="0 0 11 11"
                  width="72"
                  height="72"
                  aria-hidden="true"
                >
                  <rect x="0" y="0" width="3" height="3" />
                  <rect x="8" y="0" width="3" height="3" />
                  <rect x="0" y="8" width="3" height="3" />
                  <rect x="5" y="1" width="1" height="1" />
                  <rect x="6" y="3" width="1" height="1" />
                  <rect x="4" y="4" width="1" height="1" />
                  <rect x="8" y="5" width="1" height="1" />
                  <rect x="10" y="4" width="1" height="1" />
                  <rect x="5" y="6" width="1" height="1" />
                  <rect x="7" y="7" width="1" height="1" />
                  <rect x="9" y="8" width="1" height="1" />
                  <rect x="5" y="9" width="1" height="1" />
                  <rect x="8" y="10" width="1" height="1" />
                </svg>
                <div className={styles.releveCode}>
                  <span className={styles.releveCodeLabel}>{HOME_COPY.releve.sample.codeLabel}</span>
                  <span className={styles.releveCodeValue}>{HOME_COPY.releve.sample.code}</span>
                </div>
              </div>
            </div>

            <div className={styles.releveText}>
              <span className={styles.eyebrow}>{HOME_COPY.releve.eyebrow}</span>
              <h2 className={styles.sectionHeading}>{HOME_COPY.releve.heading}</h2>
              <p className={styles.lead}>{HOME_COPY.releve.body}</p>
              <ul className={styles.checkList}>
                {HOME_COPY.releve.points.map((point) => (
                  <li className={styles.checkItem} key={point}>
                    <Check
                      className={styles.bulletIconBrand}
                      size={ICON}
                      strokeWidth={STROKE}
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.note}>{HOME_COPY.releve.footnote}</p>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ PRIVACY */}
      <section className={styles.privacy}>
        <Container width="public">
          <div className={styles.privacyHead}>
            <span className={styles.privacyEyebrow}>{HOME_COPY.privacy.eyebrow}</span>
            <h2 className={styles.privacyHeading}>{HOME_COPY.privacy.heading}</h2>
            <p className={styles.privacyLead}>{HOME_COPY.privacy.lead}</p>
          </div>

          <ul className={styles.privacyItems}>
            {HOME_COPY.privacy.items.map((item, index) => {
              const PrivacyIcon = [EyeOff, Building2, Lock, Building2][index] ?? Lock;

              return (
                <li className={styles.privacyItem} key={item}>
                  <PrivacyIcon
                    className={styles.privacyIcon}
                    size={ICON_PRIVACY}
                    strokeWidth={STROKE}
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- APP */}
      <section id="app" className={styles.app}>
        <Container width="public">
          <div className={styles.appGrid}>
            <div className={styles.appText}>
              <span className={styles.eyebrow}>{HOME_COPY.app.eyebrow}</span>
              <h2 className={styles.sectionHeading}>{HOME_COPY.app.heading}</h2>
              <p className={styles.lead}>{HOME_COPY.app.body}</p>

              {/* The launch sign-up is parked (PARK-FW34-LAUNCH): there is no
                  launch list and the regulatory alert list's consent does not
                  cover launch news. So this points to the regulatory alerts
                  page, named for what it is, and only while alertsExist. */}
              {PRODUCT_STATE.alertsExist ? (
                <>
                  <p className={styles.lead}>{HOME_COPY.app.alertsLead}</p>
                  <a className={styles.pillPrimary} href={ALERTS_PATH}>
                    {HOME_COPY.app.alertsCta}
                    <ArrowRight size={ICON_SM} strokeWidth={STROKE} aria-hidden="true" />
                  </a>
                </>
              ) : null}

              <p className={styles.note}>{HOME_COPY.app.iosNote}</p>
            </div>

            <div className={styles.notifColumn}>
              <div className={styles.notif}>
                <div className={styles.notifHead}>
                  <span className={styles.phoneMark} aria-hidden="true" />
                  <span className={styles.notifApp}>{HOME_COPY.app.notificationApp}</span>
                </div>
                <span className={styles.notifQuestion}>{HOME_COPY.app.notificationQuestion}</span>
                <span className={styles.notifDate}>{HOME_COPY.app.notificationDate}</span>
                <div className={styles.notifChoices}>
                  {HOME_COPY.app.notificationChoices.map((choice) => (
                    <span className={styles.notifChoice} key={choice}>
                      {choice}
                    </span>
                  ))}
                </div>
              </div>
              <p className={styles.phoneCaption}>{HOME_COPY.app.notificationCaption}</p>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------- GUIDES */}
      <section className={styles.guides}>
        <Container width="public">
          <div className={styles.guidesGrid}>
            <div className={styles.lake} aria-hidden="true">
              <svg viewBox="0 0 480 220" width="100%" height="220" preserveAspectRatio="xMidYMid slice">
                <rect width="480" height="220" className={styles.lakeSky} />
                <polygon points="0,150 90,70 160,130 250,50 340,120 420,80 480,110 480,220 0,220" className={styles.lakeFar} />
                <polygon points="0,170 120,110 210,160 300,105 400,150 480,130 480,220 0,220" className={styles.lakeNear} />
                <rect y="175" width="480" height="45" className={styles.lakeWater} />
              </svg>
            </div>

            <div className={styles.guidesText}>
              <span className={styles.eyebrow}>{HOME_COPY.guides.eyebrow}</span>
              <h2 className={styles.sectionHeading}>{HOME_COPY.guides.heading}</h2>
              <p className={styles.lead}>{HOME_COPY.guides.body}</p>

              <div className={styles.guideLinks}>
                {homeGuides.map((guide) => (
                  <a className={styles.guideLink} href={guide.href} key={guide.href}>
                    <span>{guide.label}</span>
                    <ArrowRight
                      className={styles.guideArrow}
                      size={ICON_SM}
                      strokeWidth={STROKE}
                      aria-hidden="true"
                    />
                  </a>
                ))}
              </div>

              <a className={styles.guidesAll} href={GUIDES_PATH}>
                {HOME_COPY.guides.all}
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ SOURCES */}
      <section className={styles.sourcesStrip}>
        <Container width="public">
          <div className={styles.sourcesRow}>
            <Quote className={styles.sourcesIcon} size={ICON} strokeWidth={STROKE} aria-hidden="true" />
            <span className={styles.sourcesClaim}>{HOME_COPY.sources.claim}</span>
            <a className={styles.sourcesLink} href={SOURCES_PATH}>
              {HOME_COPY.sources.cta}
            </a>
          </div>
        </Container>
      </section>
    </main>
  );
}
