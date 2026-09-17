// web/app/(public)/mentions-legales/MentionsLegalesContent.tsx
//
// The prose of /mentions-legales, separated from page.tsx for ONE reason: it
// takes the entity as a prop.
//
// RULING R84 requires the placeholder count to be exact - N placeholders when
// N declared constants are empty, zero when all are filled - and both halves
// have to be provable. A page component that read LEGAL_ENTITY from module
// scope could only ever be tested in the state the repository happens to be
// in, which is "all empty"; the "all filled" direction would be untestable
// without mocking the module, and a mock would prove things about the mock.
// Passing the entity in makes both directions ordinary rendering, and lets the
// test sweep field by field.
//
// page.tsx supplies the real LEGAL_ENTITY and nothing else, so there is
// exactly one place the shipped values enter the page.
//
// NO STRING LITERALS HERE. Every word comes from lib/fr/mentions-legales.ts
// (SPEC section 5, enforced by react/jsx-no-literals) - including the
// definition-list terms, which is why they are a keyed record rather than
// prose in the JSX.

import {
  entityValue,
  isComplete,
  type LegalEntity,
  type LegalEntityField,
} from '@/lib/content/legal-entity';
import { LEGAL_ENTITY_TERMS, MENTIONS_LEGALES_COPY as COPY } from '@/lib/fr/mentions-legales';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from '../legal.module.scss';

/** The identity block, in the order a reader looks for them. */
const EDITOR_FIELDS = [
  'legalName',
  'legalForm',
  'address',
  'registrationNumber',
  'incorporatedOn',
  // FRENCH LAW WANTS A NAMED NATURAL PERSON here, and there is not one. It is
  // declared so the page PRINTS the gap - R52's whole argument: a plausible
  // blank reads as filled in, and nobody goes looking for it.
  'publicationDirector',
  'contactEmail',
] as const satisfies readonly LegalEntityField[];

// THE LCEN WANTS NAME, ADDRESS AND TELEPHONE for the host. The registration
// and website are not required and are published because they are verified
// and useful. OVH's SHARE CAPITAL IS ABSENT deliberately: published sources
// disagree on it, and the law does not ask.
const HOSTING_FIELDS = [
  'hostingProvider',
  'hostingAddress',
  'hostingPhone',
  'hostingWebsite',
  'hostingRegistration',
] as const satisfies readonly LegalEntityField[];

/**
 * RULING R84's declaration: the entity constants this page consumes.
 *
 * It is not documentation. The test fills every field but one and demands
 * exactly one placeholder, for each field in turn - so a name listed here that
 * the page never prints fails, and a value the page prints twice fails too.
 *
 * dataController and dpoContact are absent deliberately: they belong to
 * /confidentialite. Mentions legales names the publication director as the
 * legal representative of the editor, which needs no constant of its own and
 * avoids conflating two different legal roles.
 */
export const MENTIONS_LEGALES_FIELDS: readonly LegalEntityField[] = [
  ...EDITOR_FIELDS,
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

export interface MentionsLegalesContentProps {
  readonly entity: LegalEntity;
}

export function MentionsLegalesContent({ entity }: MentionsLegalesContentProps) {
  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.lead}>{COPY.intro}</p>

        {/* Only while something is open. A standing note would train a reader
            to ignore it, and there would be nothing to ignore once the values
            are filled. */}
        {isComplete(entity) ? null : <p className={styles.pending}>{COPY.pending}</p>}

        <h2 className={styles.heading}>{COPY.editorHeading}</h2>
        <EntityList entity={entity} fields={EDITOR_FIELDS} />

        <h2 className={styles.heading}>{COPY.directorHeading}</h2>
        <p className={styles.prose}>{COPY.director}</p>

        <h2 className={styles.heading}>{COPY.hostingHeading}</h2>
        <EntityList entity={entity} fields={HOSTING_FIELDS} />
        <p className={styles.prose}>{COPY.hosting}</p>

        <h2 className={styles.heading}>{COPY.propertyHeading}</h2>
        <p className={styles.prose}>{COPY.property}</p>
        <p className={styles.prose}>{COPY.propertySources}</p>

        <h2 className={styles.heading}>{COPY.lawHeading}</h2>
        <p className={styles.prose}>{COPY.law}</p>
      </Container>
    </main>
  );
}
