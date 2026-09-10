// web/lib/fr/confidentialite.ts
//
// Every word of /confidentialite. SPEC 9.7: the page "covers nLPD + GDPR,
// names the data (email, canton, rate, day logs, timestamps), the retention,
// and the export/deletion rights (D11)".
//
// ---------------------------------------------------------------------------
// EVERY CLAIM ON THIS PAGE IS TRACED, because most of them describe behaviour
// that DOES NOT EXIST YET. The prompt's rule: where a feature is not built, the
// notice describes the specified behaviour, and a code comment lists the tasks
// that must keep it true. Those tasks are:
//
//   FW14  Alerts - Prisma init, double opt-in, capture, /alertes
//         -> the double opt-in, the stored consent date, the unsubscribe link
//            in every send, and the 30-day purge of unconfirmed rows
//            (SPEC 8, AlertSubscriber.confirmedAt).
//   FW15  OG image, JSON-LD, metadata, Umami events
//         -> the audience measurement described here: self-hosted,
//            cookieless, same-origin, aggregate (SPEC 15).
//   FW21  Full Prisma schema + migrations + seed
//         -> the field list under "ce que l'application enregistre" is
//            SPEC 8's User and Entry models. A column added there makes this
//            page wrong until it is added here too.
//   FW22  Auth - magic link, App Link callback, device tokens
//         -> passwordless by emailed link (SPEC 10, D6/D23), and Device.
//   FW23  Entries API /v1 - timestamps, provenance, coordinate rejection
//         -> server-assigned timestamps, the append-only EntryEvent trail,
//            and the API refusing any payload carrying a coordinate, which
//            FW23 covers with a test that posts one and expects a 400.
//   FW26  Account export, deletion, hygiene jobs
//         -> the JSON + CSV export, and the deletion that removes the user,
//            the entries, the events, the devices and the phone's local data
//            (D11, SPEC 11.5).
//   FW27  Reminder scheduler + FCM
//         -> the notification token, and FCM being the only third-party SDK.
//   FW28  Deployment
//         -> the host, named through the R52 constants, and the error reports
//            scrubbed of email addresses and entry payloads (D32).
//   AN*   the Android detection tasks
//         -> the on-device polygon, the discarded fix, the per-day tally
//            (SPEC 13.1, D18), and that no tier writes an entry (D16).
//
// A CLAIM THIS PAGE DELIBERATELY DOES NOT MAKE. Nowhere does it say the
// service is "conforme" to anything, and a test asserts that word's absence
// alongside "certifie" and "atteste" (SPEC 20). A notice can state what a
// service does, and which texts grant the reader their rights; it cannot award
// itself a compliance verdict, and the products that do are the ones nobody
// believes.
//
// TODO-COPY: realistic French, not reviewed by counsel.

export const CONFIDENTIALITE_COPY = {
  title: 'Politique de confidentialité',

  description:
    'Ce que frontalier enregistre, ce qui ne quitte jamais votre appareil, ' +
    'les durées de conservation et vos droits.',

  intro:
    'Cette page décrit les données que le service enregistre, celles qui ne ' +
    'sont jamais enregistrées, combien de temps elles sont conservées et ce ' +
    'que vous pouvez exiger à leur sujet. Vos droits sont ceux que vous ' +
    'reconnaissent le règlement européen sur la protection des données ' +
    '(RGPD) et la loi fédérale suisse sur la protection des données (LPD).',

  pending:
    'Les mentions qui ne sont pas encore renseignées apparaissent entre ' +
    'crochets. Elles seront complétées avant la mise en service publique du ' +
    'service.',

  controllerHeading: 'Responsable du traitement',

  webHeading: 'Ce que le site public enregistre',
  web: [
    'Le site public ne dépose aucun cookie, ne vous demande aucun compte et ' +
      'ne vous identifie pas. Vous pouvez utiliser le calculateur sans rien ' +
      'communiquer.',
    'Une adresse e-mail est enregistrée uniquement si vous la donnez ' +
      'vous-même, pour recevoir les alertes réglementaires. Un lien de ' +
      'confirmation vous est alors envoyé, la date de votre accord est ' +
      'enregistrée, et chaque message contient un lien de désinscription en ' +
      'un clic.',
    "La mesure d’audience est auto-hébergée, sans cookie et sans " +
      'identifiant publicitaire. Elle compte les pages consultées et ' +
      'quelques actions agrégées, comme le fait de lancer un calcul. Elle ne ' +
      'permet pas de vous reconnaître, et aucune donnée ne part vers un ' +
      'tiers.',
  ],

  appHeading: "Ce que l’application enregistre",
  appIntro:
    "L’application Android tient le registre de vos journées. Elle " +
    'enregistre, pour votre compte et pour lui seul :',
  app: [
    'votre adresse e-mail, qui sert aussi à vous connecter, par un lien ' +
      'envoyé par message et sans mot de passe ;',
    "votre canton de travail, votre taux d’activité, votre méthode de " +
      "décompte et votre date de début d’activité ;",
    'pour chaque journée déclarée, la date, sa nature (Suisse, domicile, ' +
      'mission, absence), la portion (journée entière ou demi-journée) et le ' +
      "motif s’il s’agit d’une absence ;",
    "l’origine de chaque journée, à savoir une saisie à la main, une " +
      'proposition acceptée ou une proposition corrigée, ainsi que ce qui ' +
      "avait été proposé lorsque vous l’avez corrigée ;",
    "les horodatages, c’est-à-dire la date et l’heure auxquelles le serveur " +
      'a reçu chaque déclaration. Ils sont assignés par le serveur et jamais ' +
      "par votre téléphone : c’est ce qui donne sa valeur au relevé annuel ;",
    "l’historique des modifications, en ajout seul. Une correction ajoute " +
      "une ligne, elle n’en efface aucune ;",
    'si vous activez le rappel quotidien, un jeton de notification propre à ' +
      'votre appareil.',
  ],
  appThirdParty:
    "L’application ne communique qu’avec notre propre interface de " +
    'programmation et avec le service de notification de Google (FCM), ' +
    'utilisé uniquement pour acheminer le rappel que vous avez demandé. ' +
    "Aucun autre service tiers n’y est intégré : ni régie publicitaire, ni " +
    'outil de mesure tiers, ni identifiant publicitaire.',

  neverHeading: "Ce qui n’est jamais enregistré",
  never: [
    'Aucune coordonnée géographique. Ni latitude, ni longitude, ni altitude, ' +
      'ni vitesse : jamais enregistrée, jamais transmise, jamais ' +
      'journalisée.',
    'Si vous choisissez le mode automatique, la position est utilisée sur ' +
      'votre appareil uniquement. Chaque relevé de position est comparé à un ' +
      "polygone des frontières suisses embarqué dans l’application, puis " +
      'abandonné immédiatement. Seul un cumul de minutes par journée est ' +
      'conservé, sans aucune position.',
    'Aucun historique de déplacement, aucun nom de lieu, aucune adresse ' +
      "d’employeur, aucune carte et aucune chronologie de vos trajets. Il n’y " +
      'a rien de tel à produire si cela vous était demandé un jour.',
    'Notre interface de programmation refuse toute déclaration contenant ' +
      'une latitude, une longitude, une précision, une altitude, une vitesse ' +
      'ou un nom de fournisseur de position. Ce refus est vérifié par un test ' +
      "automatique : la garantie n’est pas seulement annoncée, elle est " +
      'empêchée techniquement.',
    "Et l’application n’enregistre jamais une journée d’elle-même. Une " +
      'détection vous propose une journée ; seule votre validation ' +
      "l’enregistre.",
  ],

  basisHeading: 'Bases légales',
  basis: [
    "L’exécution du service que vous demandez, pour votre compte, vos " +
      'journées déclarées, les horodatages et le relevé annuel.',
    'Votre consentement, pour les alertes par e-mail, pour le rappel ' +
      'quotidien et pour le mode automatique. Chacun se retire séparément et ' +
      "à tout moment, dans les paramètres de l’application.",
    "Notre intérêt légitime, pour la mesure d’audience agrégée décrite plus " +
      'haut et pour la correction des erreurs techniques du service.',
  ],

  retentionHeading: 'Durées de conservation',
  retention: [
    'Une inscription aux alertes qui reste non confirmée est supprimée au ' +
      'bout de 30 jours.',
    'Les données de votre compte et vos journées déclarées sont conservées ' +
      "jusqu’à la suppression de votre compte, que vous pouvez demander à " +
      "tout moment depuis l’application.",
    "L’historique des modifications est conservé aussi longtemps que le " +
      "compte : c’est lui qui permet de montrer quand chaque journée a été " +
      'déclarée, et le relevé perdrait sa valeur sans lui.',
    'Les rapports techniques que le service produit en cas de panne sont ' +
      'débarrassés des adresses e-mail et du contenu des déclarations avant ' +
      "d’être enregistrés.",
  ],

  hostingHeading: 'Hébergement et prestataires',
  hosting:
    'Les données sont hébergées chez le prestataire indiqué ci-dessous. Deux ' +
    'autres prestataires interviennent de façon limitée : Resend, pour ' +
    "l’envoi des messages, et le service de notification de Google (FCM), " +
    'pour acheminer le rappel quotidien vers votre appareil.',

  rightsHeading: 'Vos droits',
  rightsIntro:
    "Vous pouvez à tout moment demander l’accès à vos données, leur " +
    'rectification, leur effacement, leur portabilité, la limitation de leur ' +
    "traitement, ou retirer un consentement que vous avez donné. Vous n’avez " +
    'pas à motiver votre demande.',
  rights: [
    "Dans l’application, Exporter mes données produit un fichier JSON et un " +
      'fichier CSV contenant vos journées, leur origine et leurs horodatages.',
    "Dans l’application, Supprimer mon compte efface votre compte, vos " +
      'journées, leur historique, vos appareils enregistrés et les données ' +
      'conservées sur votre téléphone. Cette opération est définitive, et le ' +
      'relevé annuel ne peut plus être reproduit ensuite.',
    "Vous pouvez aussi écrire à l’adresse de contact indiquée plus haut.",
  ],

  complaintHeading: 'Réclamation',
  complaint:
    "Si une réponse ne vous satisfait pas, vous pouvez saisir l’autorité de " +
    'contrôle : la CNIL en France, ou le Préposé fédéral à la protection des ' +
    'données et à la transparence en Suisse.',
} as const;
