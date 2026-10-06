// web/app/(public)/cgu/CguContent.tsx
//
// The prose of /cgu. Same shape as the other two legal pages: it takes the
// entity as a prop so ruling R84's placeholder census can be proved with a
// filled entity as well as an empty one.
//
// THREE CONSUMED CONSTANTS, NOT NINE. The identity block belongs to
// /mentions-legales and the data controller to /confidentialite; repeating
// them here would print placeholders for facts already stated, and would make
// four pages to update instead of one. What terms of use actually need is who
// is bound (the editor), which court is competent (the registered office) and
// where to write.

import {
  entityValue,
  isComplete,
  type LegalEntity,
  type LegalEntityField,
} from '@/lib/content/legal-entity';
import { CGU_COPY as COPY } from '@/lib/fr/cgu';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from '../legal.module.scss';

/**
 * RULING R84's declaration: the entity constants this page consumes.
 *
 * Each is rendered exactly once - the census would fail otherwise, and the
 * prose is written to say "l'editeur" rather than repeating the name.
 */
export const CGU_FIELDS = [
  'legalName',
  'address',
  'contactEmail',
] as const satisfies readonly LegalEntityField[];

function Bullets({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className={styles.bullets}>
      {items.map((item) => (
        <li key={item} className={styles.bullet}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export interface CguContentProps {
  readonly entity: LegalEntity;
}

export function CguContent({ entity }: CguContentProps) {
  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.lead}>{COPY.intro}</p>

        {isComplete(entity) ? null : <p className={styles.pending}>{COPY.pending}</p>}

        <h2 className={styles.heading}>{COPY.publisherHeading}</h2>
        <p className={styles.prose}>{COPY.publisherLead}</p>
        <p className={styles.value}>{entityValue(entity, 'legalName')}</p>

        <h2 className={styles.heading}>{COPY.objectHeading}</h2>
        <Bullets items={COPY.object} />

        {/* R333: one account, one person; the email is the account's anchor. */}
        <h2 className={styles.heading}>{COPY.oneAccountHeading}</h2>
        <Bullets items={COPY.oneAccount} />

        {/* The boundary of what this product claims to be. Its own paragraph,
            first in its section, and asserted verbatim by the page test. */}
        <h2 className={styles.heading}>{COPY.notHeading}</h2>
        <p className={styles.prose}>{COPY.notTaxAdvice}</p>
        <Bullets items={COPY.notMore} />

        <h2 className={styles.heading}>{COPY.responsibilityHeading}</h2>
        <Bullets items={COPY.responsibility} />

        <h2 className={styles.heading}>{COPY.priceHeading}</h2>
        <Bullets items={COPY.price} />

        <h2 className={styles.heading}>{COPY.deletionHeading}</h2>
        <Bullets items={COPY.deletion} />

        <h2 className={styles.heading}>{COPY.availabilityHeading}</h2>
        <p className={styles.prose}>{COPY.availability}</p>

        <h2 className={styles.heading}>{COPY.lawHeading}</h2>
        <p className={styles.prose}>{COPY.lawLead}</p>
        <p className={styles.value}>{entityValue(entity, 'address')}</p>

        <h2 className={styles.heading}>{COPY.contactHeading}</h2>
        <p className={styles.prose}>{COPY.contactLead}</p>
        <p className={styles.value}>{entityValue(entity, 'contactEmail')}</p>
      </Container>
    </main>
  );
}
