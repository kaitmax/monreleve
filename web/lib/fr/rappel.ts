// web/lib/fr/rappel.ts
//
// FW-DELAI-RAPPEL: every server-side word of the deadline reminder - the
// answers to a submit, the outcomes a link lands on, and the two messages
// (R917). The form's own words are in lib/fr/rappel-form.ts, because only
// those ship in the comparator's island; nothing here reaches a browser
// except as the text of a page or of an answer.
//
// NOTHING IS RETYPED FROM ANOTHER SURFACE (R206). The indicative-date
// warning, the "until" sentence, the long date and the office line are
// LAMAL_COPY.deadline's, by key; the address errors that mean the same thing
// as the alert card's are ALERTES_COPY's; the lead time, the link lifetime
// and the purge are the constants the job and the purge use (R153, R181).
//
// THE MESSAGES ARE TRANSACTIONAL (R245, decided in lib/rappel/mail.ts): one
// request, one reminder, no list - so no unsubscribe line. Each carries the
// delete link instead (R916, R917).
//
// TODO-COPY: realistic French, not reviewed.

import { APP_NAME } from '@/lib/fr';
import { ALERTES_COPY } from '@/lib/fr/alertes';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { CONFIRMATION_TTL_DAYS, PURGE_AFTER_DAYS } from '@/lib/alerts/lifetimes';
import { DAYS_BEFORE } from '@/lib/rappel/window';

const APOS = String.fromCharCode(0x2019);
const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it (R91). */
const n = (mark: string): string => `${NB}${mark}`;

/** "Vous pouvez choisir l'assurance maladie française jusqu'au 28 février 2027 environ." - the helper's step 2. */
const untilLine = (deadline: string): string =>
  `${LAMAL_COPY.deadline.choose} ${LAMAL_COPY.deadline.until(LAMAL_COPY.deadline.longDate(deadline))}`;

export const RAPPEL_COPY = {
  /**
   * THE ANSWERS TO A SUBMIT, sent with the status (lib/rappel/status.ts).
   *
   * `ok` IS THE SAME FOR EVERY ADDRESS (R915): a new one, one awaiting
   * confirmation, one already confirmed. Saying "déjà programmé" would let
   * anybody learn from this form whether somebody has a reminder about a
   * Swiss health-insurance choice. The sentence is true in all three cases
   * because it is conditional.
   */
  answers: {
    ok:
      `C${APOS}est noté. Si ce rappel doit être confirmé, un message vient de ` +
      `partir${n(';')} ouvrez-le pour programmer le rappel.`,
    missing: `Indiquez une adresse e-mail pour recevoir le rappel.`,
    invalid: ALERTES_COPY.errors.emailInvalid,
    date:
      `Un rappel part ${DAYS_BEFORE} jours avant la date, et ce jour est déjà ` +
      `passé${n(':')} aucun rappel ne peut être programmé pour cette date.`,
    rate: ALERTES_COPY.errors.tooMany,
    unavailable: ALERTES_COPY.errors.unavailable,
  },

  /**
   * Where the two links land: the comparator, at "Votre délai", with the
   * outcome revealed by its fragment (ReminderOutcomes, lib/rappel/landing.ts).
   */
  outcomes: {
    confirmed: {
      heading: 'Votre rappel est programmé',
      body:
        `Vous recevrez un seul message, ${DAYS_BEFORE} jours avant la date. ` +
        `L${APOS}adresse et la date sont supprimées dès son envoi, et chaque ` +
        `message contient un lien pour les supprimer plus tôt.`,
    },
    expired: {
      heading: 'Ce lien de confirmation a expiré',
      body:
        `Il était valable ${CONFIRMATION_TTL_DAYS} jours. La demande a été ` +
        `supprimée${n(';')} vous pouvez en faire une nouvelle ci-dessous.`,
    },
    tooLate: {
      heading: 'Ce rappel ne peut plus être programmé',
      body:
        `Il devait partir ${DAYS_BEFORE} jours avant la date, et ce jour est ` +
        `passé${n(':')} rien ne vous sera envoyé, et l${APOS}adresse et la date ` +
        `ont été supprimées.`,
    },
    unknown: {
      heading: `Ce lien de confirmation n${APOS}est plus valable`,
      body:
        `Il a peut-être déjà servi${n(':')} un lien de confirmation ne ` +
        `fonctionne qu${APOS}une fois.`,
    },
    deleted: {
      heading: `L${APOS}adresse et la date sont supprimées`,
      body: 'Aucun rappel ne vous sera envoyé.',
    },
    deleteUnknown: {
      heading: 'Aucun rappel ne correspond à ce lien',
      // NOT « il n'y a rien à supprimer »: once a send has been attempted,
      // the confirmation message's older link no longer matches a row that may
      // still exist (lib/rappel/job.ts). What is true of every case is that
      // THIS link matches nothing.
      body:
        `Le rappel a peut-être déjà été envoyé ou supprimé, ou un message ` +
        `plus récent contient un nouveau lien.`,
    },
  },

  /** The confirmation message: the date, the warning by key, the link, the delete link. */
  confirmation: {
    subject: `Confirmez votre rappel du délai d${APOS}option`,
    lines: (deadline: string, confirmUrl: string, deleteUrl: string): readonly string[] => [
      'Bonjour,',
      '',
      `Vous avez demandé, sur le comparateur LAMal / CMU de ${APP_NAME}, un ` +
        `rappel avant la fin du délai du droit d${APOS}option.`,
      '',
      untilLine(deadline),
      '',
      LAMAL_COPY.deadline.warning,
      '',
      `Pour programmer ce rappel, ouvrez ce lien${n(':')}`,
      confirmUrl,
      '',
      `Ce lien est valable ${CONFIRMATION_TTL_DAYS} jours et ne fonctionne ` +
        `qu${APOS}une fois. Vous recevrez ensuite un seul message, ` +
        `${DAYS_BEFORE} jours avant cette date${n(';')} l${APOS}adresse et la ` +
        `date sont supprimées dès son envoi.`,
      '',
      `Si vous n${APOS}êtes pas à l${APOS}origine de cette demande, ignorez ce ` +
        `message${n(';')} sans confirmation, rien ne vous sera envoyé et ` +
        `l${APOS}adresse sera supprimée au bout de ${PURGE_AFTER_DAYS} jours au ` +
        `plus tard.`,
      '',
      `Pour supprimer dès maintenant l${APOS}adresse et la date${n(':')}`,
      deleteUrl,
    ],
  },

  /** The one reminder. */
  reminder: {
    subject: (deadline: string): string =>
      `Rappel${n(':')} votre délai d${APOS}option court ` +
      LAMAL_COPY.deadline.until(LAMAL_COPY.deadline.longDate(deadline)).replace(/\.$/u, ''),
    lines: (deadline: string, deleteUrl: string): readonly string[] => [
      'Bonjour,',
      '',
      `Voici le rappel que vous avez demandé sur le comparateur LAMal / CMU ` +
        `de ${APP_NAME}.`,
      '',
      untilLine(deadline),
      LAMAL_COPY.deadline.office,
      '',
      LAMAL_COPY.deadline.warning,
      '',
      `Ce message est le seul${n(':')} l${APOS}adresse et la date sont ` +
        `supprimées à son envoi. Ce lien supprime ce qui en resterait${n(':')}`,
      deleteUrl,
    ],
  },
} as const;
