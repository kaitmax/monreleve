// web/lib/fr/mentions-legales.ts
//
// Every word of /mentions-legales. SPEC section 5: user-facing strings live in
// lib/fr and nowhere else, and react/jsx-no-literals enforces it - which is
// why even the definition-list terms are here rather than typed into the JSX.
//
// EACH ENTITY VALUE IS NAMED EXACTLY ONCE ON THE PAGE, and that is a
// constraint on the prose, not an accident. Ruling R84 makes the placeholder
// count exact - it must equal the number of empty constants - so a second
// mention of the company name would print a second placeholder and break the
// census. The sections after the identity block therefore say "l'editeur",
// which is ordinary legal French and happens to be what keeps the count true.
//
// A DEFINITION LIST FOR THE IDENTITY BLOCK, not a sentence. A sentence has to
// agree in gender with a legal form nobody has chosen yet - "immatriculee"
// or "immatricule" depends on whether it turns out to be a SAS or an
// auto-entrepreneur - and a sentence with four placeholders in it is unreadable.
// A dl also gives ruling R70's `label` type pair the role it was added for.
//
// TODO-COPY: realistic French, not reviewed by counsel.

import { APP_NAME } from '@/lib/fr';
import type { LegalEntityField } from '@/lib/content/legal-entity';

/**
 * The term shown beside each entity value.
 *
 * Keyed by LegalEntityField and REQUIRED for all nine, so adding a field to
 * the entity is a type error until it has a label. Two of them -
 * dataController and dpoContact - belong to /confidentialite rather than this
 * page; they are declared here because there is one vocabulary for these
 * values across the three legal pages, not three.
 */
export const LEGAL_ENTITY_TERMS: Readonly<Record<LegalEntityField, string>> = {
  legalName: 'Dénomination sociale',
  legalForm: 'Forme juridique',
  address: 'Siège social',
  registrationNumber: "Numéro d’immatriculation",
  dataController: 'Responsable du traitement',
  dpoContact: 'Délégué à la protection des données',
  hostingProvider: 'Hébergeur',
  hostingAddress: "Adresse de l’hébergeur",
  contactEmail: 'Adresse de contact',

  // FW20c. Seven more, and the type is what required them: the map is a
  // Required<Record<LegalEntityField, string>>, so a field added to the
  // entity does not compile until somebody has written its French label.
  // That is the mechanism this file's own comment describes, working.
  incorporatedOn: "Date d’immatriculation",
  publicationDirector: 'Directeur de la publication',
  euRepresentative: "Représentant dans l’Union européenne",
  chRepresentative: 'Représentant en Suisse',
  hostingPhone: "Téléphone de l’hébergeur",
  hostingWebsite: "Site de l’hébergeur",
  hostingRegistration: "Immatriculation de l’hébergeur",
};

export const MENTIONS_LEGALES_COPY = {
  title: 'Mentions légales',

  /**
   * The meta description. Factual, because this page has nothing to sell -
   * and a page that a reader reaches while checking who runs the service is
   * badly served by marketing copy.
   */
  description:
    `Identité de l’éditeur du site ${APP_NAME}, hébergement, propriété ` +
    'intellectuelle et droit applicable.',

  intro:
    `Les informations ci-dessous identifient l’éditeur du site ${APP_NAME} et ` +
    "son hébergeur, comme l’exige la réglementation applicable aux services " +
    'de communication au public en ligne.',

  /**
   * Shown only while an entity value is still open. It describes the
   * placeholder without reproducing the string - reproducing it would add to
   * the count ruling R84 makes exact.
   */
  pending:
    "Les mentions qui ne sont pas encore renseignées apparaissent entre " +
    'crochets. Elles seront complétées avant la mise en service publique du ' +
    'site.',

  editorHeading: "Éditeur du site",

  directorHeading: 'Directeur de la publication',
  director:
    "Le directeur de la publication est le représentant légal de l’éditeur.",

  hostingHeading: 'Hébergement',
  hosting:
    "L’hébergeur assure le stockage technique du service. Il n’intervient ni " +
    'dans le contenu publié ni dans les calculs présentés.',

  propertyHeading: 'Propriété intellectuelle',
  property:
    "Les textes, les éléments graphiques et le code de ce site sont la " +
    "propriété de l’éditeur ou sont utilisés avec l’autorisation de leurs " +
    'titulaires. Toute reproduction ou représentation, totale ou partielle, ' +
    'faite sans autorisation écrite préalable est interdite.',
  propertySources:
    "Les seuils et les règles de calcul présentés reposent sur des textes " +
    "officiels français et suisses, qui ne sont la propriété de personne et " +
    "que l’éditeur ne fait que mettre en œuvre.",

  lawHeading: 'Droit applicable',
  law:
    'Ce site est soumis au droit français. En cas de litige, et à défaut de ' +
    'résolution amiable, les tribunaux français sont compétents.',
} as const;
