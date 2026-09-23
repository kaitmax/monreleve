// web/lib/fr/notifications.ts
//
// What a push notification says. FW27 increment 3.
//
// ============================================================================
// A NOTIFICATION IS THE SHORTEST SURFACE THIS PRODUCT HAS, AND THE ONLY ONE
// THAT ARRIVES UNINVITED
// ============================================================================
//
// SPEC §13.3: "a compliance tool that nags gets uninstalled". The cost of a
// badly written notification is not that it is unclear - it is that the next
// one never arrives, because the application is gone. So each of these is
// written to survive being read on a lock screen, once, by somebody who did
// not ask for it:
//
//   IT NAMES THE DAY.      "Vous avez une journée à enregistrer" is true every
//                          day of the year and tells a reader nothing they can
//                          act on. The date is in the title.
//   IT SAYS WHAT IT WANTS. Not "ouvrez l'application" alone, which spends
//                          somebody's attention to tell them nothing. The
//                          manual body names the four answers; the auto body
//                          names the one decision.
//   IT ASKS ONCE.          There is no second reminder and no digest, so
//                          nothing here nags, apologises or escalates.
//
// ============================================================================
// THE DATE ARRIVES FORMATTED, AS EVERY FIGURE IN lib/fr DOES (R147, R153)
// ============================================================================
//
// No string here types a date, a threshold or a count. The title takes the day
// already rendered by lib/ui/core/format/date.ts, which is the one place this
// product decides what a day looks like (R206) - so a notification, the
// dossier and the annex cannot disagree about 07.07.2026.

import { APP_NAME } from '@/lib/fr';

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it (R91). */
const n = (mark: string): string => `${NB}${mark}`;

// TODO-COPY: realistic French, not reviewed.

export const NOTIFICATION_COPY = {
  reminder: {
    /**
     * Manual mode: the server knows the day is empty and knows nothing else.
     *
     * THE BODY NAMES THE FOUR ANSWERS because they are the whole decision.
     * A reader who sees "domicile, Suisse, mission ou absence" knows both what
     * is being asked and that it takes one tap - which is the difference
     * between a notification that gets acted on and one that gets swiped.
     */
    manual: {
      title: (day: string): string => `Journée du ${day} à enregistrer`,
      body: `Indiquez où vous avez travaillé${n(':')} domicile, Suisse, mission ou absence.`,
    },

    /**
     * Auto mode: the device has a proposal and the server does not.
     *
     * SPEC §13.3 asks for *« Journée détectée : Domicile. Confirmer ? »* -
     * with the detected country in it. THE SERVER CANNOT WRITE THAT SENTENCE:
     * detection happens on the device, D16 writes nothing until the person
     * taps, and no table holds a pending proposal. Putting a country here
     * would be copy claiming knowledge the record does not support, which is
     * the one thing this product never does.
     *
     * So this is the FALLBACK text, carried on the notification for the case
     * where the application cannot compose its own - and the data payload
     * carries `day` and `mode` so that, when it can, it renders SPEC's
     * sentence from the proposal it already holds locally. Parked in
     * REPORT-FW27.txt: making the server able to write it would mean storing
     * proposals, which is a new table and a new thing to erase.
     */
    auto: {
      title: (day: string): string => `Journée du ${day} à confirmer`,
      body: `Ouvrez ${APP_NAME} pour confirmer la journée détectée ou la corriger.`,
    },
  },
} as const;
