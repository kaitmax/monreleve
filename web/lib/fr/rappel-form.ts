// web/lib/fr/rappel-form.ts
//
// FW-DELAI-RAPPEL, R918: the words of the reminder form in the comparator's
// "Votre délai" helper - and ONLY those, because this module ships in the
// comparator's island (Queue Ruling 23: every byte here is first-load JS on
// /calculateur-lamal-cmu). The answers to a submit are the server's
// (lib/fr/rappel.ts), sent with the status, so they are not here.
//
// THE DESIGN'S WORDS WHERE THEY ARE TRUE (docs/design/comparateur-lamal-a2,
// the form under "Votre délai"). Its line « Un seul e-mail, puis l’adresse
// est effacée » is NOT: a confirmation goes out before the one reminder, and
// the date is kept with the address. The hint says what the record supports.

const APOS = String.fromCharCode(0x2019);
const NB = String.fromCharCode(0x00a0);

export const RAPPEL_FORM_COPY = {
  label: 'Recevoir un rappel deux semaines avant',
  submit: `M${APOS}envoyer un rappel`,
  hint:
    `Un message pour confirmer, puis un seul rappel${NB}; l${APOS}adresse et ` +
    'la date sont ensuite effacées.',
  /** Only when the request never got an answer: the server words every other case. */
  offline: `Le rappel n${APOS}a pas pu être demandé. Réessayez dans quelques instants.`,
} as const;
