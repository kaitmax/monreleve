// web/app/(public)/confidentialite/ConfidentialiteContent.tsx
//
// The prose of /confidentialite. Same shape as MentionsLegalesContent and for
// the same reason: it takes the entity as a prop, so ruling R84's placeholder
// census can be proved with a filled entity as well as an empty one, without
// mocking a module.
//
// WHERE THE CLAIMS COME FROM. lib/fr/confidentialite.ts carries the trace -
// every sentence on this page maps to a SPEC section or a decision, and to the
// task that must keep it true once the feature exists. Most of what this notice
// describes is not built yet, which is exactly why the mapping is written down.
//
// NO STRING LITERALS HERE (SPEC 5, react/jsx-no-literals). The bulleted lists
// are arrays in lib/fr and are keyed by their own text, which is unique per
// list and does not shift when a bullet is inserted.

import {
  entityValue,
  isComplete,
  type LegalEntity,
  type LegalEntityField,
} from '@/lib/content/legal-entity';
import { CONFIDENTIALITE_COPY as COPY } from '@/lib/fr/confidentialite';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { LEGAL_ENTITY_TERMS } from '@/lib/fr/mentions-legales';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from '../legal.module.scss';

/**
 * The controller block. Who is responsible, where they are, how to reach them
 * and their data protection officer.
 */
const CONTROLLER_FIELDS = [
  'dataController',
  'address',
  'dpoContact',
  'contactEmail',
  // GDPR Art. 27 and nLPD Art. 14. Both MAY be required of a UK controller
  // targeting French and Swiss residents, and neither has been appointed.
  // R138: declaring them prints the open question; it does not claim an
  // appointment. The site must not say it has a representative it has not.
  'euRepresentative',
  'chRepresentative',
] as const satisfies readonly LegalEntityField[];

const HOSTING_FIELDS = ['hostingProvider', 'hostingAddress'] as const satisfies readonly LegalEntityField[];

/**
 * RULING R84's declaration: the entity constants this page consumes.
 *
 * legalName and legalForm are absent deliberately. A privacy notice has to
 * identify the CONTROLLER, which is what dataController is for; the company's
 * registered name and legal form belong to /mentions-legales. Naming both here
 * would print two placeholders for one fact and say nothing extra.
 */
export const CONFIDENTIALITE_FIELDS: readonly LegalEntityField[] = [
  ...CONTROLLER_FIELDS,
  ...HOSTING_FIELDS,
];

interface EntityListProps {
  readonly entity: LegalEntity;
  readonly fields: readonly LegalEntityField[];
}

function EntityList({ entity, fields }: EntityListProps) {
  return (
    <dl className={styles.list}>
      {fields.map((field) => (
        <div key={field} className={styles.row}>
          <dt className={styles.term}>{LEGAL_ENTITY_TERMS[field]}</dt>
          <dd className={styles.value}>{entityValue(entity, field)}</dd>
        </div>
      ))}
    </dl>
  );
}

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

export interface ConfidentialiteContentProps {
  readonly entity: LegalEntity;
}

export function ConfidentialiteContent({ entity }: ConfidentialiteContentProps) {
  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.lead}>{COPY.intro}</p>

        {isComplete(entity) ? null : <p className={styles.pending}>{COPY.pending}</p>}

        <h2 className={styles.heading}>{COPY.controllerHeading}</h2>
        <EntityList entity={entity} fields={CONTROLLER_FIELDS} />

        <h2 className={styles.heading}>{COPY.webHeading}</h2>
        {/* FW-WEB-ACCOUNT (R900): the section as the product state makes it
            true - the account area's cookie sentence appears only while the
            area exists (R172). */}
        <Bullets items={COPY.webFor(PRODUCT_STATE)} />

        <h2 className={styles.heading}>{COPY.appHeading}</h2>
        <p className={styles.prose}>{COPY.appIntro}</p>
        <Bullets items={COPY.app} />
        <p className={styles.prose}>{COPY.appThirdParty}</p>

        {/* The section the whole product rests on - SPEC 13.1's hard rule. */}
        <h2 className={styles.heading}>{COPY.neverHeading}</h2>
        <Bullets items={COPY.never} />

        <h2 className={styles.heading}>{COPY.basisHeading}</h2>
        <Bullets items={COPY.basis} />

        <h2 className={styles.heading}>{COPY.retentionHeading}</h2>
        <Bullets items={COPY.retention} />

        <h2 className={styles.heading}>{COPY.hostingHeading}</h2>
        <p className={styles.prose}>{COPY.hosting}</p>
        <EntityList entity={entity} fields={HOSTING_FIELDS} />

        <h2 className={styles.heading}>{COPY.rightsHeading}</h2>
        <p className={styles.prose}>{COPY.rightsIntro}</p>
        <Bullets items={COPY.rights} />

        <h2 className={styles.heading}>{COPY.complaintHeading}</h2>
        <p className={styles.prose}>{COPY.complaint}</p>
      </Container>
    </main>
  );
}
