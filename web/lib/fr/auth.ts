// web/lib/fr/auth.ts
//
// The sign-in message. FW22.
//
// PLAIN TEXT, ONE LINK, FOR FW14's REASONS (lib/fr/emails.ts): a message read
// once in two seconds on a phone, in a client nobody chose. HTML costs
// rendering differences and spam-filter suspicion and buys nothing.
//
// R153 - IT NAMES WHAT IT IS FOR AND QUOTES NO FIGURE. There is no threshold
// in this mail, no percentage, no number of days. Not because it would be
// wrong today, but because an email template cannot interpolate from RuleSet:
// a figure typed here is the copy that still says 40 % in 2028 with every
// test green. The message says what the link does; the product says what the
// rules are.
//
// NO GREETING BY NAME. At the moment this is sent, the only thing known about
// the reader is an address they just typed - and on a first sign-in there may
// be no account at all. "Bonjour Jean" would be an invention on the one
// message somebody uses to decide whether this is legitimate.
//
// TODO-COPY: realistic French, not reviewed.

import { APP_NAME } from '@/lib/fr';

const APOS = String.fromCharCode(0x2019);
const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it (R91). */
const n = (mark: string): string => `${NB}${mark}`;

export const AUTH_EMAIL_COPY = {
  signIn: {
    /**
     * Forty characters is what a phone shows, so the useful words go first:
     * what this is, then whose.
     */
    subject: `Votre lien de connexion ${APP_NAME}`,

    /**
     * The body, as lines. Kept as an array so a test can assert what is in it
     * without matching whitespace.
     *
     * THE MINUTES ARE INTERPOLATED FROM THE TTL, never typed (R153/R181).
     * Change MAGIC_LINK_TTL_MS and this sentence follows; type "15" here and
     * it is a figure in a format that cannot interpolate, which is exactly
     * what R153 forbids.
     */
    lines: (signInUrl: string, minutes: number): readonly string[] => [
      `Bonjour,`,
      ``,
      `Voici votre lien de connexion${n(':')}`,
      signInUrl,
      ``,
      `Il est valable ${minutes}${NB}minutes et ne fonctionne qu${APOS}une seule fois.`,
      ``,
      `Ce lien ouvre l${APOS}application ${APP_NAME}, où vous notez vos journées ` +
        `de télétravail et de présence en Suisse.`,
      ``,
      // THE "NOT ME" SENTENCE IS NOT BOILERPLATE. This message is sent to any
      // address somebody types, so a person who never asked for it will
      // receive one. It has to say, in one line, that ignoring it is
      // sufficient and that nothing has been created in their name.
      `Si vous n${APOS}êtes pas à l${APOS}origine de cette demande, ignorez ce ` +
        `message${n(':')} aucun compte n${APOS}a été créé et ce lien expirera seul.`,
    ],
  },
} as const;
