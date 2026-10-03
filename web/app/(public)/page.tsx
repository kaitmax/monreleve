// web/app/(public)/page.tsx
//
// THE HOME BODY (FW34, slice 2 of docs/.../2026-09-29-home-page-design.md, H1).
// A hero, three destination cards, a "Pourquoi une trace datee" band, a trust
// band and a closing strip - FD11. It reverses FW20's "no hero theatre": the two
// equal doors are gone.
//
// A SERVER COMPONENT, with no client JavaScript of its own (§3). It computes
// every value once and passes it into HOME_COPY's getters, which hold the words
// (R147: no figure is typed; R172/R186: state sentences come from PRODUCT_STATE,
// one clause per flag). lib/fr imports nothing from lib/guides or
// lib/content/sources (§5.4); the registry reads node:fs, so the reading is done
// here and the strings arrive formatted.
//
// THE TABULAR-FIGURE PROOF (FW1 AC1) is NOT here: it moved to /dev/composants at
// FW20 and composants.spec.ts:277 still asserts it. home.spec.ts keeps the
// weaker page-level check that Inter is served.

import type { Metadata } from 'next';
import { ArrowRight, BookOpen, Calculator, Smartphone } from 'lucide-react';
import { HOME_COPY } from '@/lib/fr';
import { frenchList } from '@/lib/fr/compose';
import { SHELL_COPY } from '@/lib/fr/shell';
import { currentTaxYear } from '@/lib/content/tax-year';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { LAST_REGULATORY_REVIEW } from '@/lib/content/regulatory';
import { SOURCE_ENTRIES, SOURCE_IDS } from '@/lib/content/sources';
import { guideScope } from '@/lib/guides/scope';
import { publishedGuides } from '@/lib/guides/registry';
import { Button } from '@/lib/ui/react/Button/Button';
import { Card } from '@/lib/ui/react/Card/Card';
import { Container } from '@/lib/ui/react/Container/Container';
import { IconTile } from '@/lib/ui/react/IconTile/IconTile';
import styles from './home.module.scss';

// The description names both thresholds and types neither (R147); a static
// export cannot call anything, so this stays a function. Unchanged by FW34, and
// deliberately a DIFFERENT sentence from the lead (R206).
export function generateMetadata(): Metadata {
  const { fiscal, social } = guideScope(currentTaxYear());

  return { description: HOME_COPY.description(fiscal, social, PRODUCT_STATE) };
}

// FD11's five card-2 topics, in its order. Their labels are each guide's own
// breadcrumbLabel (R181, derived not typed), first letter lowercased so they sit
// inside the sentence.
const CARD_TWO_TOPICS = [
  'teletravail-frontalier-40-pourcent',
  'seuil-social-49-9-pourcent',
  'jours-de-mission-hors-suisse',
  'attestation-employeur-teletravail',
  'droit-option-lamal-cmu',
] as const;

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

const ARROW_SIZE = 16;
const ARROW_STROKE = 1.75;

/** A `text` Button with its trailing arrow (passed as a child, so Button imports no icon). */
function TextLink({ label, href }: { readonly label: string; readonly href: string }) {
  return (
    <Button href={href} variant="text">
      {label}
      <ArrowRight aria-hidden size={ARROW_SIZE} strokeWidth={ARROW_STROKE} />
    </Button>
  );
}

export default function HomePage() {
  const { fiscal, social, a1Threshold } = guideScope(currentTaxYear());
  const published = publishedGuides();

  // Card 2: the count and the five topic labels, derived.
  const guideCount = published.length;
  const topics = frenchList(
    CARD_TWO_TOPICS.map((slug) => {
      const guide = published.find((one) => one.frontmatter.slug === slug);

      if (guide === undefined) {
        throw new Error(`home: FD11 card-2 topic slug is not a published guide: ${slug}`);
      }

      return lowerFirst(guide.frontmatter.breadcrumbLabel);
    }),
  );

  // Trust band: the distinct publishers in registry order, and the source counts.
  const publishers = frenchList([...new Set(SOURCE_ENTRIES.map((entry) => entry.sourceName))]);
  const transcribed = SOURCE_ENTRIES.filter((entry) => entry.status === 'transcribed').length;
  const pending = SOURCE_ENTRIES.filter((entry) => entry.status === 'pending').length;
  const total = SOURCE_IDS.length;
  const review = LAST_REGULATORY_REVIEW;

  const { actions, lead, cards, pourquoi, trust, closing } = HOME_COPY;
  const heroSecondary = PRODUCT_STATE.appExists ? actions.app : actions.guides;

  const leadText = [
    lead.fiscal.text(fiscal),
    lead.social.text(social, a1Threshold),
    lead.tracker(PRODUCT_STATE),
  ].join(' ');

  const verificationBody = trust.verification.body(review);

  return (
    <main>
      {/* HERO */}
      <section className={styles.hero} data-band="hero">
        <Container width="public">
          <div className={styles.heroColumn}>
            <h1 className={styles.title}>{HOME_COPY.heading(fiscal)}</h1>
            <p className={styles.lead}>{leadText}</p>
            <div className={styles.actions}>
              <Button href={actions.calculator.href} variant="primaryLarge">
                {actions.calculator.label}
              </Button>
              <Button href={heroSecondary.href} variant="secondary">
                {heroSecondary.label}
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* DESTINATION CARDS */}
      <section className={styles.cardsBand} data-band="cards">
        <Container width="public">
          <h2 className="u-visually-hidden">{cards.heading}</h2>
          <div className={styles.cards}>
            <Card>
              <div className={styles.cardBody}>
                <IconTile>
                  <Calculator />
                </IconTile>
                <h3 className={styles.cardTitle}>{cards.calculator.title}</h3>
                <p className={styles.cardText}>{cards.calculator.body(fiscal, social)}</p>
                <TextLink href={cards.calculator.link.href} label={cards.calculator.link.label} />
              </div>
            </Card>
            <Card>
              <div className={styles.cardBody}>
                <IconTile>
                  <BookOpen />
                </IconTile>
                <h3 className={styles.cardTitle}>{cards.guides.title}</h3>
                <p className={styles.cardText}>{cards.guides.body(guideCount, topics)}</p>
                <TextLink href={actions.guides.href} label={actions.guides.label} />
              </div>
            </Card>
            <Card>
              <div className={styles.cardBody}>
                <IconTile>
                  <Smartphone />
                </IconTile>
                <h3 className={styles.cardTitle}>{cards.app.title}</h3>
                <p className={styles.cardText}>{cards.app.body(PRODUCT_STATE)}</p>
                <TextLink href={actions.app.href} label={actions.app.label} />
              </div>
            </Card>
          </div>
        </Container>
      </section>

      {/* POURQUOI UNE TRACE DATEE */}
      <section className={styles.pourquoi} data-band="pourquoi">
        <Container width="public">
          <h2 className={styles.pourquoiHeading}>{pourquoi.heading}</h2>
          <div className={styles.pourquoiGrid}>
            {pourquoi.items.map((item, index) => (
              <div className={styles.pourquoiItem} key={item.heading}>
                <p className={styles.numeral}>{String(index + 1).padStart(2, '0')}</p>
                <h3 className={styles.pourquoiItemHeading}>{item.heading}</h3>
                <p className={styles.pourquoiBody}>{item.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* TRUST BAND */}
      <section className={styles.trust} data-band="trust">
        <Container width="public">
          <h2 className="u-visually-hidden">{trust.heading}</h2>
          <Card padding="spacious">
            <div className={styles.trustColumns}>
              <div className={styles.trustColumn}>
                <h3 className={styles.eyebrow}>{trust.sources.eyebrow}</h3>
                <p className={styles.trustBody}>{trust.sources.body(publishers)}</p>
                <TextLink href={trust.sources.link.href} label={trust.sources.link.label} />
              </div>
              <div className={styles.trustColumn}>
                <h3 className={styles.eyebrow}>{trust.review.eyebrow}</h3>
                <p className={styles.trustStatus}>{trust.review.status}</p>
                <p className={styles.trustBody}>{trust.review.body(transcribed, total, pending)}</p>
                <TextLink href={trust.review.link.href} label={trust.review.link.label} />
              </div>
              <div className={styles.trustColumn}>
                <h3 className={styles.eyebrow}>{trust.verification.eyebrow}</h3>
                <p className={styles.verificationDate}>
                  {trust.verification.status(review, SHELL_COPY.reviewPending)}
                </p>
                {verificationBody !== null ? (
                  <p className={styles.trustBody}>{verificationBody}</p>
                ) : null}
                <TextLink
                  href={trust.verification.link.href}
                  label={trust.verification.link.label}
                />
              </div>
            </div>
          </Card>
        </Container>
      </section>

      {/* CLOSING STRIP */}
      <section className={styles.closing} data-band="closing">
        <Container width="public">
          <Card padding="spacious">
            <div className={styles.closingInner}>
              <p className={styles.closingLine}>{closing.line}</p>
              <Button href={actions.calculator.href} variant="primary">
                {actions.calculator.label}
              </Button>
            </div>
          </Card>
        </Container>
      </section>
    </main>
  );
}
