// web/lib/content/legal-entity.ts
//
// RULING R52: the legal entity, its address, the data controller and the
// hosting details are OPEN QUESTIONS (SPEC 22, question 14). The three legal
// pages are written in full French anyway, with every entity-specific value as
// a visible placeholder collected here, so the operator fills it once.
//
// WHY A PLACEHOLDER RATHER THAN A GUESS. A default of "frontalier SAS" would
// be a claim about a company that does not exist, printed on the page where a
// reader is most entitled to rely on it. And it would be invisible: a plausible
// name reads as filled in, so nobody would ever go looking for it. The
// placeholder is the honest version of not knowing - it is legible on the page,
// it is countable by a test, and it cannot be mistaken for an answer.
//
// RULING R84 MAKES THAT COUNT EXACT. Each legal page declares the constants it
// consumes and the rendered placeholder count must equal the number of those
// that are empty. So the helpers here answer one question precisely - is this
// field missing - and answer it the same way for the pages and for the tests.
//
// WHITESPACE IS MISSING. A single space satisfies a length check and prints as
// nothing, which is the exact failure R52 exists to prevent: a legal page that
// looks complete and states no company name. trim() is not tidiness here, it
// is the definition.

import { LEGAL_PLACEHOLDER } from '@/lib/fr/legal';

/** Every entity-specific value the legal pages need. Nine, per the prompt. */
export interface LegalEntity {
  /** The registered company name. */
  readonly legalName: string;
  /** SAS, SARL, auto-entrepreneur - whatever it turns out to be. */
  readonly legalForm: string;
  /** The registered office, on one line. */
  readonly address: string;
  /** SIREN, SIRET or the equivalent. */
  readonly registrationNumber: string;
  /** Responsable du traitement, for the nLPD and GDPR notice. */
  readonly dataController: string;
  /** How to reach the data protection officer, if one is appointed. */
  readonly dpoContact: string;
  /** The hosting provider's name. */
  readonly hostingProvider: string;
  /** The hosting provider's address. */
  readonly hostingAddress: string;
  /** The public contact address. */
  readonly contactEmail: string;
}

export type LegalEntityField = keyof LegalEntity;

/**
 * The fields, as data.
 *
 * The interface cannot be iterated at runtime and the pages need to iterate,
 * so this list exists - and a test pins it against Object.keys(LEGAL_ENTITY),
 * because a field added to the interface but missing here would never be
 * checked for emptiness and would never print a placeholder.
 */
export const LEGAL_ENTITY_FIELDS = [
  'legalName',
  'legalForm',
  'address',
  'registrationNumber',
  'dataController',
  'dpoContact',
  'hostingProvider',
  'hostingAddress',
  'contactEmail',
] as const satisfies readonly LegalEntityField[];

/**
 * THE SHIPPED VALUES, AND THEY ARE ALL EMPTY ON PURPOSE.
 *
 * Filling one is a one-line edit here and nothing else - no page, no test and
 * no copy file mentions a company name.
 */
export const LEGAL_ENTITY: LegalEntity = {
  legalName: '',
  legalForm: '',
  address: '',
  registrationNumber: '',
  dataController: '',
  dpoContact: '',
  hostingProvider: '',
  hostingAddress: '',
  contactEmail: '',
};

/** Whitespace counts as missing - see the module comment. */
function present(value: string): boolean {
  return value.trim() !== '';
}

/** Every field still to be filled, in declaration order. */
export function missingFields(entity: LegalEntity): readonly LegalEntityField[] {
  return LEGAL_ENTITY_FIELDS.filter((field) => !present(entity[field]));
}

/** True once every field carries a value. */
export function isComplete(entity: LegalEntity): boolean {
  return missingFields(entity).length === 0;
}

/**
 * What a page prints for a field: the value, or the placeholder.
 *
 * The placeholder comes from lib/fr rather than being declared here, because a
 * second copy of the string would be a second thing to change - and the page
 * test counts occurrences of the lib/fr one, so a drifted copy would report
 * zero placeholders on a page full of them.
 */
export function entityValue(entity: LegalEntity, field: LegalEntityField): string {
  const value = entity[field];

  return present(value) ? value.trim() : LEGAL_PLACEHOLDER;
}
