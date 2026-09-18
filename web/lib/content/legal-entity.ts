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

/**
 * Every entity-specific value the legal pages need.
 *
 * NINE AT FW10, SIXTEEN AT FW20c. The seven added are the ones the filled
 * values made necessary: an incorporation date and the host’s telephone,
 * website and registration, which the LCEN and a reader both want - and
 * three that are DELIBERATELY EMPTY, so the page states them as gaps
 * rather than omitting them.
 */
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
  /** The date of incorporation, ISO, for the editor's identification. */
  readonly incorporatedOn: string;
  /**
   * The directeur de la publication.
   *
   * FRENCH LAW REQUIRES A NAMED NATURAL PERSON, and the operator has not
   * supplied one. It must NOT be inferred from a git author, a commit or a
   * company officer: the obligation is on a person who accepts it, and a name
   * guessed from version control would be a claim about somebody's legal
   * responsibility made by a script.
   */
  readonly publicationDirector: string;
  /**
   * The EU representative under GDPR Art. 27.
   *
   * MAY be required for a UK controller targeting French residents. Awaiting
   * legal advice, and R138 governs the page: the site does not claim to have
   * appointed one.
   */
  readonly euRepresentative: string;
  /** The Swiss representative under nLPD Art. 14. Same advice, same question. */
  readonly chRepresentative: string;
  /** The hosting provider's telephone, which the LCEN requires. */
  readonly hostingPhone: string;
  /** The hosting provider's website. */
  readonly hostingWebsite: string;
  /** The hosting provider's own registration. */
  readonly hostingRegistration: string;
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
  'incorporatedOn',
  'publicationDirector',
  'euRepresentative',
  'chRepresentative',
  'hostingPhone',
  'hostingWebsite',
  'hostingRegistration',
] as const satisfies readonly LegalEntityField[];

/**
 * THE SHIPPED VALUES, AND THEY ARE ALL EMPTY ON PURPOSE.
 *
 * Filling one is a one-line edit here and nothing else - no page, no test and
 * no copy file mentions a company name.
 */
export const LEGAL_ENTITY: LegalEntity = {
  // Verified by the operator against Companies House on 17.09.2026.
  legalName: 'KAMELEO LTD',
  legalForm: 'Private limited company, registered in England and Wales',
  address: '128 City Road, London EC1V 2NX, United Kingdom',
  registrationNumber: '15274008 (Companies House)',
  incorporatedOn: '2023-11-10',

  // THE CONTROLLER IS THE COMPANY, NAMED. The operator's note reads "KAMELEO
  // LTD, at the address above" - a description of who and where, not a string
  // to print: the address is rendered by the same page a few lines up, in
  // French, and an English clause inside a French legal page would be the
  // only English on it. So the company is the value and the page says where.
  dataController: 'KAMELEO LTD',
  contactEmail: 'contact@monreleve.ch',

  // Verified against OVHcloud's own legal pages on 17.09.2026. The LCEN wants
  // the host's name, address and telephone; OVH's share capital is NOT stated
  // here, because published sources disagree on it and the law does not ask.
  hostingProvider: 'OVH SAS',
  hostingAddress: '2 rue Kellermann, 59100 Roubaix, France',
  hostingPhone: '1007 (depuis la France) / +33 9 72 10 10 07',
  hostingWebsite: 'https://www.ovhcloud.com',
  hostingRegistration: 'RCS Lille Metropole 424 761 419',

  // ---------------------------------------------------------------------
  // STILL EMPTY, AND THE EMPTINESS IS THE POINT (R52).
  //
  // Each of these prints a visible placeholder on the page that needs it, so
  // a reader sees an acknowledged gap rather than a silent omission - and a
  // test counts them, so the gap cannot be closed by deleting the row.
  // ---------------------------------------------------------------------

  /**
   * THE NAMED NATURAL PERSON FRENCH LAW REQUIRES, supplied by the operator
   * on 18.09.2026.
   *
   * SPELLED AS THE OPERATOR WROTE IT. A person s name is not French prose and
   * R155 does not reach it: capitalisation and accents belong to the person,
   * not to the copy rules, and inventing either would be the same class of
   * guess R52 forbids one field over.
   *
   * IT WAS EMPTY FROM FW10 TO FW20c and it was the last placeholder on
   * /mentions-legales. The rule that kept it empty - never infer a natural
   * person from a git author, a commit trailer or a company officer - is why
   * it could only ever be filled by somebody telling us.
   */
  publicationDirector: 'Khalid Ait mouna',

  /** GDPR Art. 27. Awaiting legal advice - see PARK-13. */
  euRepresentative: '',

  /** nLPD Art. 14. Same advice, same question. */
  chRepresentative: '',

  /**
   * No DPO has been appointed, and this stays empty until one is - or until
   * the advice says none is required, at which point the honest change is to
   * remove the row rather than to fill it.
   *
   * NOT ON FW20c's LIST of three outstanding fields, which named only the
   * publication director and the two representatives. It is a FOURTH gap, and
   * it is raised as a question rather than quietly filled.
   */
  dpoContact: '',
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
