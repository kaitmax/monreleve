// web/lib/fr/legal.ts
//
// $legal-01, the standing disclaimer (SPEC 9.3 item 6, SPEC section 17.6).
// It appears on every calculating surface and in the PDF footer, and
// DESIGN-SYSTEM.md section 5 lists it among the things that survive a
// redesign.
//
// VOCABULARY (SPEC section 20): déclaré, enregistré, horodaté. Never
// certifié, attesté, conforme. Those three words are precisely what a
// well-meaning edit reaches for when trying to make a disclaimer sound
// reassuring, and each of them claims something this product cannot support:
// that someone has checked the days, rather than that the service recorded
// what the user declared and stamped when. A test asserts their absence.
//
// TODO-COPY: realistic French, not reviewed by counsel.

export const LEGAL_COPY = {
  standing:
    'Estimation fournie à titre indicatif, sur la base des jours que vous ' +
    'avez déclarés. Chaque jour enregistré est horodaté par le service. Ce ' +
    "document ne constitue pas un conseil fiscal et n'engage ni " +
    "l'administration française ni l'administration suisse.",
} as const;

/**
 * RULING R52: what a legal page prints where an entity value is still open.
 *
 * IT IS DELIBERATELY UGLY. Square brackets and capitals, so that a reader who
 * lands on the page before the company is registered sees an obvious gap
 * rather than a plausible-looking blank, and so that a screenshot of the page
 * shows the operator what is left to do.
 *
 * ONE STRING, ONE PLACE. The pages never write it, the entity module never
 * writes it, and ruling R84's test counts occurrences of THIS constant - so a
 * second copy anywhere would make a page full of gaps report zero.
 *
 * ACCENTED, per ruling R90: "correct French. It's user-facing; the relay's
 * ASCII mandate is about prompts, not product copy." The relay files could not
 * have spelled it this way even if they meant to, so their spelling was never
 * evidence - which is why FW10 asked rather than guessed.
 */
export const LEGAL_PLACEHOLDER = '[À COMPLÉTER]';
