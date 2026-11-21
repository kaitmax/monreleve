// web/lib/fr/cgu.ts
//
// Every word of /cgu. SPEC 9.7: "must state explicitly: record-keeping tool,
// not tax advice."
//
// ONE SENTENCE MATTERS MORE THAN THE REST OF THE PAGE, and it is
// notTaxAdvice below. A test asserts it is rendered verbatim, because it is
// the boundary of what this product claims to be: a record of what the user
// declared, timestamped, formatted - and nothing about whether the numbers are
// the right ones. Softening it to "ne remplace pas un conseil fiscal" would be
// a weaker and different statement, so the assertion is on the exact string
// rather than on a keyword.
//
// VOCABULARY (SPEC 20). Declare, enregistre, horodate - never certifie,
// atteste, conforme. The temptation on this page is the DENIAL: "le service
// n'atteste rien" says the right thing with the wrong word, and the test bans
// the substring rather than the claim, so the prose says "il ne verifie pas"
// instead. Which is clearer anyway.
//
// TODO-COPY: realistic French, not reviewed by counsel.

import { APP_NAME } from '@/lib/fr';

export const CGU_COPY = {
  title: "Conditions générales d’utilisation",

  description:
    `Ce que ${APP_NAME} fait, ce dont vous restez responsable, le tarif, la ` +
    'suppression du compte et le droit applicable.',

  intro:
    `Ces conditions régissent l’utilisation du site ${APP_NAME} et de ` +
    "l’application qui lui est associée. En les utilisant, vous les acceptez. " +
    "La version applicable est celle publiée sur cette page.",

  pending:
    'Les mentions qui ne sont pas encore renseignées apparaissent entre ' +
    'crochets. Elles seront complétées avant la mise en service publique du ' +
    'service.',

  publisherHeading: 'Éditeur',
  publisherLead: 'Le service est édité par :',

  objectHeading: 'Objet du service',
  object: [
    `${APP_NAME} est un outil de tenue de registre. Il enregistre les ` +
      'journées que vous déclarez, il les horodate au moment où le serveur ' +
      'les reçoit, et il met en forme un relevé annuel à partir de ces ' +
      'seules déclarations.',
    'Il calcule également, à partir des mêmes déclarations, votre part de ' +
      'télétravail annuelle et le nombre de jours qui vous séparent des ' +
      'seuils applicables. Ce calcul est une estimation indicative.',
  ],

  // R333: an account and its releve belong to ONE person, and the email is the
  // account anchor. Copy, sourced in the product own terms - no regulatory
  // claim (R146), and no banned word.
  oneAccountHeading: 'Un compte, une personne',
  oneAccount: [
    'Un compte et le relevé qu’il produit appartiennent à une seule ' +
      'personne. Ils ne sont pas destinés à être partagés entre plusieurs ' +
      'personnes.',
    'Votre adresse e-mail est le point d’ancrage du compte. C’est par ' +
      'elle que vous vous connectez, et c’est à elle que le compte est ' +
      'rattaché.',
  ],

  notHeading: "Ce que le service n’est pas",

  /**
   * THE SENTENCE. Asserted verbatim by tests/unit/pages/cgu.test.tsx, and the
   * one string on this page that should not be edited without deciding to.
   */
  notTaxAdvice:
    "Le service ne constitue pas un conseil fiscal, juridique ou social. Il " +
    "n’engage ni votre employeur, ni l’administration française, ni " +
    "l’administration suisse, ni aucune autre administration.",

  notMore: [
    "Aucune réponse donnée par le service ne préjuge de la position qu’une " +
      'administration retiendra. Pour une situation particulière, adressez-' +
      "vous à un professionnel ou à l’administration concernée.",
    'Le relevé annuel est un document que vous produisez à partir de vos ' +
      'propres déclarations. Sa valeur vient de ce qui y est écrit et de la ' +
      'date à laquelle chaque journée a été enregistrée, non de son ' +
      'émetteur.',
  ],

  responsibilityHeading: 'Vos déclarations, votre responsabilité',
  responsibility: [
    "L’exactitude des journées que vous déclarez vous incombe. Le service " +
      'enregistre ce que vous déclarez et la date à laquelle il le reçoit ; ' +
      'il ne vérifie pas que la déclaration correspond à la réalité, et il ' +
      'ne peut pas le faire.',
    'En mode automatique, une détection vous propose une journée. La ' +
      'proposition ne vaut pas déclaration : rien ne devient une journée ' +
      "enregistrée avant que vous ne l’ayez validée, et vous restez libre de " +
      'la corriger.',
    'Un enregistrement tardif reste possible et il est signalé comme tel sur ' +
      'le relevé. Cette mention existe pour être honnête sur la qualité du ' +
      'registre, et non pour vous pénaliser.',
  ],

  priceHeading: 'Accès et tarif',
  price: [
    "Le service est gratuit en 2027, sans limitation de fonctionnalité et " +
      'sans engagement.',
    "Il devient payant à partir de 2028. Le tarif sera annoncé avant son " +
      "entrée en vigueur, et vous resterez libre d’exporter vos données et de " +
      'supprimer votre compte sans rien payer.',
  ],

  deletionHeading: 'Suppression du compte',
  deletion: [
    "Vous pouvez supprimer votre compte à tout moment depuis l’application, " +
      'sans avoir à motiver votre demande.',
    'La suppression efface votre compte, vos journées déclarées, leur ' +
      'historique, vos appareils enregistrés et les données conservées sur ' +
      'votre téléphone. Elle est définitive, et le relevé annuel ne peut plus ' +
      'être reproduit ensuite : exportez vos données avant de supprimer si ' +
      'vous souhaitez les garder.',
  ],

  availabilityHeading: 'Disponibilité et évolution',
  availability:
    "Le service peut être interrompu pour maintenance ou pour une raison " +
    "technique. Les journées que vous déclarez hors connexion sont " +
    "conservées sur votre téléphone et transmises dès que la connexion " +
    "revient ; l’horodatage retenu est alors celui de la réception par le " +
    'serveur. Pour chaque journée saisie dans l’application, avec ou sans ' +
    'connexion, le relevé indique aussi, à titre indicatif, l’heure annoncée ' +
    'par votre téléphone.',

  lawHeading: 'Droit applicable et juridiction',
  lawLead:
    'Ces conditions sont soumises au droit français. À défaut de résolution ' +
    "amiable, le litige relève des tribunaux du ressort du siège social de " +
    "l’éditeur :",

  contactHeading: 'Contact',
  contactLead: 'Pour toute question relative à ces conditions :',
} as const;
