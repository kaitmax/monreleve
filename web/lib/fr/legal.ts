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
