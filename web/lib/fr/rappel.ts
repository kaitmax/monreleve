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
import { RAPPEL_FORM_COPY } from '@/lib/fr/rappel-form';
import { DAYS_BEFORE } from '@/lib/rappel/window';

const APOS = String.fromCharCode(0x2019);
const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it (R91). */
const n = (mark: string): string => `${NB}${mark}`;

/**
 * R1000: WHAT A DELETION LEAVES - NOTHING - said in the same words wherever a
 * request is removed without a reminder, and asserted on the rendered outcome.
 */
const NOTHING_KEPT = `L${APOS}adresse et la date ont été supprimées${n(':')} rien n${APOS}est conservé.`;

/** "Vous pouvez choisir l'assurance maladie française jusqu'au 28 février 2027 environ." - the helper's step 2. */
/**
 * R1001: a confirmed request changes only through its owner's link, so the
 * confirmation says how to change the date: delete, then ask again.
 */
const RAPPEL_COPY_CHANGE_DATE =
  `Pour changer de date, supprimez cette demande par le lien ci-dessous, ` +
  `puis faites-en une nouvelle sur le comparateur.`;

const untilLine = (deadline: string): string =>
  `${LAMAL_COPY.deadline.choose} ${LAMAL_COPY.deadline.until(LAMAL_COPY.deadline.longDate(deadline))}`;

export const RAPPEL_COPY = {
  /** R1000: the sentence every deleting outcome ends on (see NOTHING_KEPT). */
  nothingKept: NOTHING_KEPT,

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
    /** R1004: the helper's own sentence, by key (R206), which names the rule and not the figure (R153). */
    far: RAPPEL_FORM_COPY.tooFar,
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
        `passé${n(':')} rien ne vous sera envoyé. ${NOTHING_KEPT}`,
    },
    unknown: {
      heading: `Ce lien de confirmation n${APOS}est plus valable`,
      body:
        `Il a peut-être déjà servi${n(':')} un lien de confirmation ne ` +
        `fonctionne qu${APOS}une fois.`,
    },
    // R1003: ONE OUTCOME FOR "DELETED NOW" AND "NO ROW FOR THIS LINK". Every
    // delete link works for as long as its row exists, so these words are
    // true after the button deleted the row, after a send or a lapse took it,
    // and for a token never issued - and they tell a caller nothing about
    // which it was.
    deleted: {
      heading: `Aucune adresse ni date n${APOS}est enregistrée pour ce lien`,
      body: `Aucun rappel ne sera envoyé pour cette demande${n(';')} rien n${APOS}en est conservé.`,
    },
    // The database refused: nothing was deleted, and the outcome must not say
    // otherwise - the person would stop expecting a message and receive it.
    deleteFailed: {
      heading: `La suppression n${APOS}a pas pu être faite`,
      body: `Rien n${APOS}a été modifié. Réessayez dans quelques instants avec le lien du message.`,
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
      RAPPEL_COPY_CHANGE_DATE,
      '',
      `Pour supprimer dès maintenant l${APOS}adresse et la date${n(':')}`,
      deleteUrl,
    ],
    /** R1001: how to change the date - the delete link, then a new request. */
    changeDate: RAPPEL_COPY_CHANGE_DATE,
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
        `supprimées à son envoi. S${APOS}il en restait quelque chose, ce lien ` +
        `permet de le supprimer${n(':')}`,
      deleteUrl,
    ],
  },

  /**
   * R1002: THE PAGE THE DELETE LINK OPENS - one button, and only the button
   * deletes, so a mail client that fetches the link deletes nothing.
   */
  deletePage: {
    title: 'Supprimer la demande de rappel',
    heading: `Supprimer votre demande de rappel${n('?')}`,
    body:
      `L${APOS}adresse et la date de fin du délai seront supprimées, et aucun ` +
      `rappel ne sera envoyé pour cette demande. Rien n${APOS}est supprimé tant ` +
      `que vous n${APOS}appuyez pas sur ce bouton.`,
    button: `Supprimer l${APOS}adresse et la date`,
  },
} as const;
