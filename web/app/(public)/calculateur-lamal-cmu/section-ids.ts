// web/app/(public)/calculateur-lamal-cmu/section-ids.ts
//
// The droit d'option page's section ids, in reading order (FW-COMPARATEUR-A2-
// PAGE, W20, R1048). They were the chips' targets; since FW-CALC-REDESIGN
// (R1408) the chips are gone and each id sits on its accordion's content, so
// a fragment still lands and opens it. ONE LIST: ComparatorSections.tsx and
// page.tsx put the ids on what they render, and the
// unit and e2e tests read it rather than retyping a fragment (R171).
//
// A plain module rather than an export of ComparatorSections.tsx, because the
// e2e specs import it too, and Playwright's loader cannot import the
// stylesheet that component file pulls in.
//
// None of them collides with the reminder links' fragments, which are all
// rappel-* (lib/rappel/landing.ts).

export const SECTION_ID = {
  compare: 'comparer',
  deadline: 'delai',
  final: 'definitif',
  family: 'famille',
  scope: 'couverture',
  france: 'france',
  switzerland: 'suisse',
  limits: 'limites',
  sources: 'sources',
} as const;
