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

import { APP_NAME } from '@/lib/fr';
import { PURGE_AFTER_DAYS } from '@/lib/alerts/lifetimes';
import { DAYS_BEFORE } from '@/lib/rappel/window';
import type { ProductState } from '@/lib/content/product-state';

/**
 * THE ENUMERATED RECORDS, KEYED - and keyed so that something else can point
 * at them without restating them.
 *
 * lib/content/personal-data.ts maps every stored database column to one of
 * these keys, and its test asserts each key is actually rendered. The first
 * version of that map held COPIES of these sentences, and R126 caught it:
 * French written twice is French that drifts, and the copy the page renders
 * would have stopped being the copy the privacy guard checks.
 *
 * R181 - the text a reader sees is derived from the thing it describes,
 * never transcribed alongside it. The alternative on offer was to pick
 * apostrophe-free substrings so the guard could not see the duplication,
 * which is evasion rather than a fix.
 */
export const DISCLOSED_RECORDS = {
  // --- Recorded by the public site, before any account exists.
  // EACH CASE NAMES ITSELF, and cropping the baseline is what showed why.
  // The lead sentence announced « deux cas seulement » (three since
  // FW-DELAI-RAPPEL, and now COUNTED from EMAIL_CASES below) and then rendered as a
  // BULLET AT THE SAME LEVEL as the two cases it announces, with the
  // unrelated audience sentence following at that level too. A reader
  // scanning the list met a promise of two cases and then three more peers.
  //
  // The count was a promise the LAYOUT broke: nothing grouped the cases under
  // their lead, so each began « Pour... » and read as a subordinate clause
  // hunting for the sentence it came from. Naming them « Premier cas » and
  // « Second cas » makes each bullet self-locating, so the text keeps the
  // promise without the rendering having to. FW-DELAI-RAPPEL made it three,
  // so « Second cas » became « Deuxième cas »: « second » is the last of two.
  //
  // Not a nested list, deliberately: the section renders a flat array, and
  // changing that shape for one section is a rendering change reaching every
  // page that uses it. Copy is the cheaper and more reversible fix.
  alertList:
    'Premier cas, les alertes réglementaires, si vous donnez votre adresse ' +
    'vous-même. Un lien de confirmation vous est alors envoyé, la date de ' +
    'votre accord est enregistrée, et chaque message contient un lien de ' +
    'désinscription en un clic.',
  signInLink:
    'Deuxième cas, la connexion à votre compte, lorsqu’un lien de connexion ' +
    'est demandé pour cette adresse. Le service enregistre alors, le temps ' +
    'que le lien reste valable, l’adresse et une empreinte du lien — jamais ' +
    'le lien lui-même. Tant que ce lien n’a pas été ouvert, aucun compte ' +
    'n’existe, et si personne ne l’ouvre il ne reste rien.',

  // FW-CODE-CAP (R361). SAID BECAUSE SOMETHING IS KEPT, not because it is
  // interesting: a six-digit code can be guessed, so the attempts are
  // counted per address and the count has to outlive a restart. What is
  // kept is an EMPREINTE - the address is never stored here - and it is
  // kept for 24 hours. The sentence says all three, because the
  // enumeration this belongs to is closed and a column it does not cover
  // makes the page false rather than merely incomplete.
  codeAttempts:
    'Lorsqu’un code à six chiffres est saisi pour cette adresse, le ' +
    'service enregistre une empreinte de l’adresse — jamais l’adresse ' +
    'elle-même — et l’heure de chaque tentative, afin d’empêcher qu’un ' +
    'code soit deviné à force d’essais. Ces traces sont effacées au bout ' +
    'de vingt-quatre heures.',

  // FW-DELAI-RAPPEL (R919): ONE SENTENCE - what is kept (the address and the
  // date), why (one reminder), until when (the send, the date passing, the
  // link, and the purge of a request nobody confirmed). The lead time and
  // the purge are the constants the job and the purge use (R153, R181),
  // never typed. The DeadlineReminder table maps here column by column
  // (lib/content/personal-data.ts), and tests/db/rappel-delai*.test.ts bind
  // each clause to the code that performs it.
  deadlineReminder:
    'Troisième cas, le rappel du délai du droit d’option, si vous le ' +
    'demandez sur le comparateur LAMal / CMU : le service enregistre votre ' +
    'adresse et la date de fin du délai calculée par le comparateur, pour vous ' +
    `envoyer un seul rappel ${DAYS_BEFORE} jours avant cette date, et les supprime ` +
    'dès l’envoi de ce rappel, une fois cette date passée, ou aussitôt par ' +
    'le lien présent dans chaque message ; une demande qui n’est pas ' +
    `confirmée par le lien reçu est supprimée au bout de ${PURGE_AFTER_DAYS} jours ` +
    'au plus tard.',

  // --- Recorded for an account, under « pour votre compte et pour lui seul ».
  email:
    'votre adresse e-mail, qui sert aussi à vous connecter, par un lien ' +
    'envoyé par message et sans mot de passe ;',
  profile:
    'votre canton de travail, votre taux d’activité, votre méthode de ' +
    'décompte et votre date de début d’activité ;',
  day:
    'pour chaque journée déclarée, la date, sa nature (Suisse, domicile, ' +
    'mission, absence), la portion (journée entière ou demi-journée) et le ' +
    'motif s’il s’agit d’une absence ;',
  // AN-COPY-TRUTH (R1222): « de la détection automatique » names where a
  // proposal comes from, so the record NEVER_STATEMENTS.automaticMode points
  // at says that a validated day was derived from detection - what the Data
  // safety form declares as Approximate location (Android Ruling 18 Q-DS1).
  // AN-COPY-TRUTH-2 (R1231, A13 Q4): Entry.detectedAt is disclosed here
  // (lib/content/personal-data.ts), so the record names it - the PHONE’s clock
  // at the tap that accepted or corrected the proposal (AujourdhuiController
  // .recordDetected, EveningTap). It is NOT one of the server’s horodatages
  // below, and says it is the phone’s so the two cannot be read as one.
  provenance:
    'l’origine de chaque journée, à savoir une saisie à la main, une ' +
    'proposition de la détection automatique acceptée ou une proposition ' +
    'corrigée, ainsi que ce qui ' +
    'avait été proposé lorsque vous l’avez corrigée et, pour une journée ' +
    'proposée, l’heure indiquée par votre téléphone au moment où vous ' +
    'l’avez validée ;',
  timestamps:
    'les horodatages, c’est-à-dire la date et l’heure auxquelles le serveur ' +
    'a reçu chaque déclaration. Ils sont assignés par le serveur et jamais ' +
    'par votre téléphone : c’est ce qui donne sa valeur au relevé annuel ;',
  history:
    'l’historique des modifications, en ajout seul. Une correction ajoute ' +
    'une ligne, elle n’en efface aucune ;',
  notificationToken:
    'si vous activez le rappel quotidien, un jeton de notification propre à ' +
    'votre appareil ;',

  // FW27 ADDED THIS ONE, and it had to: the scheduler stores which days a
  // reminder went out, and the enumeration here is CLOSED - a stored column
  // with no line to disclose it is not an omission but a published falsehood.
  // tests/unit/content/personal-data.ts refused the new table until this
  // existed, which is the guard doing exactly its job.
  //
  // IT SAYS WHY, because "we record when we contacted you" invites the
  // question and the answer is reassuring: the trace exists so that a
  // technical retry cannot send a second notification.
  reminderLog:
    'si vous activez le rappel quotidien, les jours pour lesquels un rappel ' +
    'vous a été envoyé. Cette trace existe pour qu’une relance technique ne ' +
    'puisse pas vous en envoyer un second ;',

  // --- FW22 ADDED THESE THREE, AND THE LIST IS CLOSED. « pour votre compte
  // et pour lui seul » is exhaustive: an addition does not make it
  // incomplete, it makes it FALSE. Sessions and credentials were stored from
  // the moment sign-in shipped, and a reader was being told the list ended
  // before them.
  //
  // The failure direction matters. Claiming to hold MORE than is held is
  // safe; claiming LESS is the one a notice cannot afford, and a
  // hand-maintained list drifts that way at every task that adds a column.
  sessions:
    'vos connexions : une ligne par appareil connecté, indiquant quand la ' +
    'session a commencé, quand elle a servi pour la dernière fois, et si ' +
    'elle a pris fin — déconnexion, déconnexion de tous les appareils, ' +
    'suppression du compte, ou réutilisation détectée d’un identifiant ;',
  credentials:
    'les identifiants de connexion eux-mêmes, sous forme d’empreinte et ' +
    'jamais en clair, avec leur date d’émission et d’expiration. Une ' +
    'empreinte ne permet pas de reconstituer l’identifiant ;',
  // FW-WEB-ACCOUNT (R899). The website's account area keeps one row per
  // sign-in. The enumeration is CLOSED, so the table needs its line before a
  // single row is written; it is tied to the SCHEMA (personal-data.ts), not to
  // whether the area is offered, because a table that exists is disclosed.
  // Each column is true of a clause: when it began (createdAt), when it
  // expires (expiresAt), whether and why it ended (revokedAt, revokedReason),
  // the person (userId, id) and the hashed identifier (tokenHash).
  webSession:
    'si vous vous connectez à votre espace sur le site, une ligne par ' +
    'connexion, indiquant quand elle a commencé, quand elle expire et si ' +
    'elle a pris fin par une déconnexion. L’identifiant que garde votre ' +
    'navigateur n’est enregistré que sous forme d’empreinte ;',
  emailConfirmed:
    'la date à laquelle vous avez confirmé votre adresse en ouvrant un lien ' +
    'de connexion.',

  // FW-VERIFY (R331). The service records WHEN the name on your releves changed,
  // and the notice says exactly that - the DATE, never the former value. The
  // closed list makes it a line rather than a choice (R206): a stored column
  // with no disclosure is a published falsehood.
  nameChange:
    'les dates auxquelles le nom figurant sur vos relevés a été modifié — ' +
    'jamais l’ancienne valeur, seulement la date du changement ;',

  // FW-VERIFY (R329). Each releve produced leaves a record of WHAT WAS ISSUED,
  // and the closed list makes this a line rather than an option: a stored table
  // with no disclosure here is a published falsehood, not a gap (R206). It says
  // what the record holds and why it exists - to let whoever holds the document
  // confirm it corresponds to what the service issued, which is the one claim
  // the feature makes.
  issuanceRecord:
    'pour chaque relevé que vous générez, un enregistrement de ce qui a été ' +
    'émis : un identifiant unique, l’année concernée, un numéro de version, ' +
    'le nom tel qu’il figure sur le document, les chiffres imprimés et une ' +
    'empreinte du fichier produit. Toute personne détenant le relevé peut en ' +
    'vérifier le code sur la page de vérification, qui n’affiche alors que ce ' +
    'qui figure sur le document et jamais votre compte ;',
} as const;

/**
 * THE CASES IN WHICH THE PUBLIC SITE RECORDS AN ADDRESS, in the order the
 * notice names them. Each sentence opens with its ordinal - « Premier cas »,
 * « Deuxième cas », « Troisième cas » - and the lead sentence counts this list
 * (tests/unit/content/privacy-cases.test.ts asserts both).
 */
export const EMAIL_CASES = ['alertList', 'signInLink', 'deadlineReminder'] as const satisfies readonly (keyof typeof DISCLOSED_RECORDS)[];

/** The count, in words, as the lead sentence says it. */
const CASE_COUNT_WORDS: readonly string[] = ['aucun', 'un', 'deux', 'trois', 'quatre', 'cinq'];
const caseCount = (count: number): string => CASE_COUNT_WORDS[count] ?? String(count);

/**
 * The public-site statements that are not data disclosures.
 *
 * KEYED FOR THE SAME REASON DISCLOSED_RECORDS IS. tests/db/privacy-claims.ts
 * used to reach these by POSITION - web[0], web[1], web[2] - and FW22 put two
 * sentences in the middle of the array. Seven assertions then pointed at the
 * wrong sentence and gate:clone caught it, because the index was a literal
 * that happened to be correct rather than a name for the thing it meant
 * (R171). Keys do not move when the list does.
 */
export const WEB_STATEMENTS = {
  noCookies:
    'Le site public ne dépose aucun cookie, ne vous demande aucun compte et ' +
    'ne vous identifie pas. Vous pouvez utiliser le calculateur sans rien ' +
    'communiquer.',
  // FW-WEB-ACCOUNT (R900, Queue Ruling 12). THE ONE EXCEPTION, AND IT IS
  // DERIVED: CONFIDENTIALITE_COPY.webFor(state) places it after noCookies only
  // while PRODUCT_STATE.webAccountExists, the same fact that puts the header's
  // sign-in link on the page (R172). Its two claims are each held by a test
  // (tests/db/privacy-claims.test.ts CLAIM 1): never sent to a public page
  // (R900's census and crawl), and one session cookie with the attributes the
  // account area states. No duration is typed (R153): it says the cookie
  // expires, and lib/auth/web-session.ts says when.
  accountCookie:
    'Votre espace sur le site, si vous vous y connectez, est la seule partie ' +
    'du site qui dépose un cookie. Ce cookie de session sert uniquement à vous ' +
    'garder connecté dans cet espace. Il n’est jamais envoyé aux pages ' +
    'publiques, et il est effacé à la déconnexion ou expire de lui-même.',
  // COUNTED, NOT TYPED (Queue Ruling 24). « deux cas seulement » went false
  // by count the day a third case was stored, with every guard green; the
  // number now comes from the list of cases the page renders.
  emailCases:
    `Une adresse e-mail est enregistrée dans ${caseCount(EMAIL_CASES.length)} ` +
    'cas seulement, et jamais sans une action de votre part.',
  analytics:
    'Le site ne mesure pas encore son audience. Lorsqu’il le fera, la ' +
    'mesure sera auto-hébergée, sans cookie et sans identifiant ' +
    'publicitaire. Elle comptera les pages consultées et quelques ' +
    'actions agrégées, comme le fait de lancer un calcul. Elle ne ' +
    'permettra pas de vous reconnaître, et aucune donnée ne partira ' +
    'vers un tiers.',
} as const;

/**
 * The never-recorded statements other files point at, keyed for the reason
 * WEB_STATEMENTS is: a test reaches them by name, never by position (R171).
 */
export const NEVER_STATEMENTS = {
  // R325 (AN-NEXT-2): the position’s DETERMINATION, said plainly. With the
  // network fallback the app added for indoor days, Android may work the
  // position out from nearby Wi-Fi and cell networks (the system’s location
  // service), so « sur votre appareil uniquement » would claim more than is
  // true. The app still keeps and sends nothing; the phone does consult that
  // service, and the reader controls it through the phone’s own settings.
  // Future tense for the determination clause (R138, the app is unreleased).
  //
  // PARKAN-37 (R320): detection is FOUR CHECKS A DAY, not a minutes tally.
  // The old sentence ended "Seul un cumul de minutes par journee est
  // conserve" - a description of the continuous-sampling model R320 removed
  // (detection/Tally.kt and the minutes-and-hysteresis tally are gone). The
  // daily record now keeps, per check, only a conclusion (INSIDE/OUTSIDE/
  // BUFFER = en Suisse / domicile / proche frontiere), never minutes and
  // never a position. The Android strings are noted, not changed here.
  //
  // AN-COPY-TRUTH (R1222, A6 F5b). THE HALF IT DID NOT SAY. The Data safety
  // form declares Approximate location COLLECTED (Android Ruling 18 Q-DS1,
  // docs/play-release.md section 2): a day the person validates from a
  // proposal is sent, with what detection had proposed (detectedKind is the
  // CH/HOME side even when the person corrected it to a mission or an
  // absence), and stored. Said here because a reader meets « never sends your
  // position » under a "never recorded" heading and must not conclude that
  // nothing of automatic mode leaves the phone. « De tout cela » bounds the
  // « ne... que » to what detection produces - the account's other records
  // are the list above. The record is NOT described again (R181, R206): the
  // sentence points at it, « plus haut », and the page test asserts that the
  // provenance record really renders above this one.
  automaticMode:
    'Si vous choisissez le mode automatique, votre position est analysée sur ' +
    'votre appareil. Pour la déterminer, Android pourra utiliser les réseaux ' +
    'Wi-Fi et cellulaires à proximité, selon les réglages de localisation de ' +
    'votre téléphone. L’application, elle, ne conservera ni n’enverra jamais ' +
    'votre position. Chaque relevé de position est comparé à un polygone des ' +
    "frontières suisses embarqué dans l’application, puis abandonné " +
    'immédiatement. Pour décider d’une journée, l’application vérifiera ' +
    'votre position à quatre moments fixes de la journée. Pour chacun, elle ' +
    'ne conservera que la conclusion, en Suisse, à domicile ou près de la ' +
    'frontière, jamais une position. De tout cela, elle n’enverra que la ' +
    'journée que vous aurez validée, avec ce que la détection vous avait ' +
    'proposé, en Suisse ou à domicile. Cette journée sera enregistrée avec ' +
    'son origine, comme indiqué plus haut.',
} as const;

export const CONFIDENTIALITE_COPY = {
  title: 'Politique de confidentialité',

  description:
    `Ce que ${APP_NAME} enregistre, ce qui ne quitte jamais votre appareil, ` +
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
    WEB_STATEMENTS.noCookies,

    // FW22 MADE THE OLD SENTENCE FALSE. It read "Une adresse e-mail est
    // enregistrée UNIQUEMENT si vous la donnez vous-même, POUR RECEVOIR LES
    // ALERTES RÉGLEMENTAIRES", and then described double opt-in, a stored
    // consent date and a one-click unsubscribe.
    //
    // « uniquement ... pour » is a CLOSED PURPOSE and sign-in is now a second
    // one. None of the three guarantees applies to it: no double opt-in on a
    // sign-in link, no consent date, no unsubscribe link. Leaving it standing
    // described the alert list's protections as though they covered an
    // address recorded for a different reason.
    //
    // « si vous la donnez vous-même » was strained too: the sign-in endpoint
    // accepts an address typed by anyone, so a row can exist for somebody who
    // never asked. That is why the sign-in message says no account was created.
    WEB_STATEMENTS.emailCases,
    DISCLOSED_RECORDS.alertList,
    DISCLOSED_RECORDS.signInLink,

    // FW-CODE-CAP (R361). BESIDE THE SIGN-IN LINK because it is the same
    // moment in the same flow: a reader who has just read what is kept when
    // a link is requested should read what is kept when a code is typed,
    // without having to find a different section.
    DISCLOSED_RECORDS.codeAttempts,

    // FW-DELAI-RAPPEL (R919): the third case, after the sign-in flow that the
    // second case and its code line describe together.
    DISCLOSED_RECORDS.deadlineReminder,

    // R138: a privacy claim is written in the tense that matches the code.
    // Present tense from FW10 for analytics that do not exist; the future
    // tense is the honest form until FW15 ships Umami, and
    // tests/db/privacy-claims.test.ts pins the tense until then so the flip
    // cannot happen without the mapping.
    WEB_STATEMENTS.analytics,
  ],

  /**
   * The public-site section AS RENDERED: `web`, with the account area's
   * cookie sentence directly after noCookies while the area exists.
   *
   * FW-WEB-ACCOUNT (R900, Queue Ruling 12, R172). A function of the state, not
   * a second list: the page renders this, and tests/unit/content/product-state
   * .test.ts flips webAccountExists and requires the section to change. The
   * sentence sits right after noCookies because it is that sentence's one
   * exception, and a reader should meet the rule and its exception together.
   */
  webFor: (state: ProductState): readonly string[] =>
    state.webAccountExists
      ? [
          CONFIDENTIALITE_COPY.web[0],
          WEB_STATEMENTS.accountCookie,
          ...CONFIDENTIALITE_COPY.web.slice(1),
        ]
      : CONFIDENTIALITE_COPY.web,

  // THE HEADING SAID l’application, AND THE APPLICATION DOES NOT EXIST.
  // Every row FW22 writes is written by the SERVER - the sign-in token, the
  // account, the session, the credentials - and there is no Android client in
  // this repository to write anything. R138: a claim is written in the tense
  // AND THE VOICE that match the code.
  appHeading: 'Ce que le service enregistre pour votre compte',
  appIntro:
    'Le service tient le registre de vos journées et ce qu’il faut pour ' +
    'vous y donner accès. Il enregistre, pour votre compte et pour lui ' +
    'seul :',
  // DERIVED, NOT RESTATED. The sentences live in DISCLOSED_RECORDS above so
  // that lib/content/personal-data.ts can point at them by key without
  // copying the French (R126, R181).
  app: [
    DISCLOSED_RECORDS.email,
    DISCLOSED_RECORDS.profile,
    DISCLOSED_RECORDS.day,
    DISCLOSED_RECORDS.provenance,
    DISCLOSED_RECORDS.timestamps,
    DISCLOSED_RECORDS.history,
    DISCLOSED_RECORDS.notificationToken,
    // FW27. It sits beside the token because both are conditional on the same
    // opt-in, and a reader who enables the reminder should meet both
    // consequences together rather than one here and one in a changelog.
    DISCLOSED_RECORDS.reminderLog,
    DISCLOSED_RECORDS.sessions,
    DISCLOSED_RECORDS.credentials,
    // FW-WEB-ACCOUNT (R899): beside the device sessions it parallels.
    DISCLOSED_RECORDS.webSession,
    DISCLOSED_RECORDS.emailConfirmed,
    // FW-VERIFY: the issuance record. It sits last because it is produced by an
    // explicit act - generating a releve - rather than held from sign-in.
    DISCLOSED_RECORDS.issuanceRecord,
    // FW-VERIFY: the name-change dates (R331).
    DISCLOSED_RECORDS.nameChange,
  ],
  // R138 AGAIN, AND ONLY CROPPING THE BASELINE FOUND IT. This paragraph said
  // « L’application ne communique qu’avec... » in the PRESENT TENSE about an
  // application that does not exist - the same defect corrected in appHeading
  // and appIntro two paragraphs above, sitting directly beneath them.
  //
  // MY OWN HEADING CHANGE IS WHAT MADE IT VISIBLE. While the section was
  // titled « Ce que l’application enregistre » the subject was introduced and
  // this paragraph read as part of it. Retitling to « le service » left the
  // sentence talking about a subject the section no longer names, in a tense
  // the code does not support. Every guard passed - the strings are present,
  // the typography is right, no figure is typed. R135 earning itself: the
  // only thing that catches this is a person cropping the image and reading
  // it.
  //
  // The future tense is the honest form until AN14 ships a client, and it
  // says what is true today FIRST, as the audience sentence above does.
  appThirdParty:
    'L’application Android n’existe pas encore. Lorsqu’elle existera, elle ' +
    'ne communiquera qu’avec notre propre interface de programmation et ' +
    'avec le service de notification de Google (FCM), utilisé uniquement ' +
    'pour acheminer le rappel que vous aurez demandé. Aucun autre service ' +
    'tiers n’y sera intégré : ni régie publicitaire, ni outil de mesure ' +
    'tiers, ni identifiant publicitaire.',

  neverHeading: "Ce qui n’est jamais enregistré",
  never: [
    'Aucune coordonnée géographique. Ni latitude, ni longitude, ni altitude, ' +
      'ni vitesse : jamais enregistrée, jamais transmise, jamais ' +
      'journalisée.',
    // AN-COPY-TRUTH (R1222): keyed, so the test that holds it to the Data
    // safety form reads it by name (R206). Its history is on the key.
    NEVER_STATEMENTS.automaticMode,
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
    // CORRECTED BY FW14, and the correction is AC3 working rather than a
    // tidy-up. This sentence said every consent is withdrawn "dans les
    // paramètres de l'application" - true of the daily reminder and of
    // automatic detection, and NOT TRUE of the alert list, which anybody can
    // join from the public site without ever installing anything. A reader
    // who subscribed on the web and wanted out would have been sent looking
    // for a setting in an app they do not have.
    //
    // The list has always been leavable: every message carries a one-click
    // unsubscribe link (FW14 increment 4). The page now says where.
    'Votre consentement, pour les alertes par e-mail, pour le rappel ' +
      'quotidien et pour le mode automatique. Chacun se retire séparément et ' +
      'à tout moment. Les alertes se retirent par le lien de désinscription ' +
      'présent dans chaque message, le rappel et le mode automatique dans ' +
      "les paramètres de l’application.",
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
    // FW-VERIFY (R329/R331): how long the issuance records and the name-change
    // dates are kept - the WHAT is disclosed above, the HOW LONG is here, as
    // the history line does.
    'Les relevés que vous générez, leur enregistrement et les dates de ' +
      'changement du nom sont conservés jusqu’à la suppression de votre ' +
      'compte.',
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
    // R242: THE TENSE, NOT THE DETAIL. These two said "Dans l'application"
    // while there is no application - a present-tense claim about a channel
    // that is not open, which is what R138 governs. The conditional costs the
    // reader nothing: they still learn exactly HOW, and the sentence stops
    // asserting they can do it today. Same move as FW15's analytics line,
    // where "le site ne mesure pas encore son audience" was stronger than the
    // claim it replaced because it stated a fact and then promised a
    // mechanism.
    //
    // The server side is built (FW26): the export and the erasure exist as
    // API routes. What does not exist is a client, so what is conditional is
    // the WAY IN rather than the right.
    "Dans l’application mobile, lorsqu’elle sera disponible, Exporter mes " +
      'données produira un fichier JSON et un fichier CSV contenant vos ' +
      'journées, leur origine et leurs horodatages.',
    "Dans l’application mobile, lorsqu’elle sera disponible, Supprimer mon " +
      'compte effacera votre compte, vos journées, leur historique, vos ' +
      'appareils enregistrés et les données conservées sur votre téléphone. ' +
      'Cette opération est définitive, et le relevé annuel ne peut plus être ' +
      'reproduit ensuite.',
    // WHAT SURVIVES, SAID OUT LOUD (FW26). The alert list is keyed by address
    // and is a separate consent under a separate identity - most addresses on
    // it never had an account. Deleting the account would revoke a consent
    // nobody withdrew; keeping it silently would be worse, because somebody
    // who asked to be forgotten and then receives an email has been told
    // something untrue by the absence of this sentence.
    "Si votre adresse figure aussi sur la liste d’alerte, cette inscription " +
      'est un consentement distinct et elle subsiste après la suppression du ' +
      'compte. Le lien de désinscription reçu lors de la confirmation reste ' +
      'valable, et un seul clic suffit.',
    "Vous pouvez aussi écrire à l’adresse de contact indiquée plus haut.",
  ],

  complaintHeading: 'Réclamation',
  complaint:
    "Si une réponse ne vous satisfait pas, vous pouvez saisir l’autorité de " +
    'contrôle : la CNIL en France, ou le Préposé fédéral à la protection des ' +
    'données et à la transparence en Suisse.',
} as const;
