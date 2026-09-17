// web/lib/fr/emails.ts
//
// The messages this product sends. FW14.
//
// PLAIN TEXT, AND THAT IS A DECISION. A confirmation mail is read once, in
// two seconds, often on a phone in a mail client nobody chose. HTML buys
// nothing here and costs something real: an image-heavy double-opt-in is
// indistinguishable from the marketing mail this list is not, it renders
// differently in every client, and it is what spam filters are trained on. A
// short plain message from a real domain, containing one link, is the version
// most likely to arrive and be believed.
//
// THE ONE-LINE STATEMENT OF WHAT THE LIST IS FOR is in the increment for a
// reason: somebody who forgot subscribing five minutes ago should be able to
// tell from the message itself whether it is legitimate, without clicking
// anything.
//
// NO TRACKING PIXEL, NO OPEN RATE, NO CLICK WRAPPING. /confidentialite says
// the public site does not identify the reader. A tracking pixel in the
// confirmation mail would make that untrue on the one message every
// subscriber receives.
//
// TODO-COPY: realistic French, not reviewed.

import { APP_NAME } from '@/lib/fr';
import { MAIL_SUBDOMAIN } from '@/lib/content/identity';
import { ALERTES_COPY } from '@/lib/fr/alertes';

/** Written once, in the copy module the pages use (R126). */
const EMAIL_COPY_UNSUBSCRIBE = ALERTES_COPY.unsubscribe.emailLink;

const APOS = String.fromCharCode(0x2019);
const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it (R91). */
const n = (mark: string): string => `${NB}${mark}`;

export const EMAIL_COPY = {
  confirmation: {
    /**
     * The subject. Says what to do and what it is about, in that order,
     * because a phone shows about forty characters of it.
     */
    subject: `Confirmez votre inscription aux alertes ${APP_NAME}`,

    /**
     * The body, as lines. Joined with newlines by the sender; kept as an
     * array so the test can assert what is in it without matching whitespace.
     *
     * NO GREETING BY NAME because there is no name - the list holds an
     * address and nothing else, and "Bonjour Jean" would be the first lie in
     * a product whose entire value is not overstating what it knows.
     */
    lines: (confirmUrl: string, unsubscribeUrl: string): readonly string[] => [
      `Bonjour,`,
      ``,
      `Vous avez demandé à être prévenu quand les règles du télétravail ` +
        `frontalier changent${n(':')} seuils, accords fiscaux, positions des ` +
        `administrations. C${APOS}est le seul objet de cette liste.`,
      ``,
      `Pour terminer votre inscription, ouvrez ce lien${n(':')}`,
      confirmUrl,
      ``,
      `Ce lien est valable sept jours et ne fonctionne qu${APOS}une fois.`,
      ``,
      `Si vous n${APOS}êtes pas à l${APOS}origine de cette demande, ignorez ce ` +
        `message${n(';')} sans confirmation, votre adresse est supprimée au bout ` +
        `de trente jours et vous ne recevrez rien d${APOS}autre.`,
      ``,
      // ONE-CLICK UNSUBSCRIBE IN EVERY SEND, including this one. A reader
      // who has not confirmed can still say "not me, and stop" without
      // waiting thirty days for the row to lapse - and a message that asks
      // for consent while offering no way to refuse is asking badly.
      `${EMAIL_COPY_UNSUBSCRIBE}${n(':')}`,
      unsubscribeUrl,
    ],
  },
} as const;

/**
 * The sender.
 *
 * A subdomain rather than the apex: SPF and DKIM records for a sending
 * subdomain can be changed without touching the records the apex uses for
 * everything else, and a deliverability problem stays contained. Those DNS
 * records are an operator task and belong to FW28 - noted there rather than
 * attempted here, because nothing in this repository can create them.
 */
// THE NAME AND THE DOMAIN BOTH DERIVE (R188). This line carried the only
// `.fr` host in the repository - notifications.frontalier.fr - which was a
// FOURTH form of the product identity hiding in a string nobody renders on
// a page. R171 applies to a mail host exactly as to a canonical.
export const EMAIL_FROM = `${APP_NAME} <alertes@${MAIL_SUBDOMAIN}>`;
