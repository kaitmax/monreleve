// web/tests/setup/address-bar.ts
//
// FW13 increment 4: the address bar is now SHARED MUTABLE STATE between tests.
//
// WHAT HAPPENED. Increment 2 makes the calculator seed itself from
// window.location.search on mount, and increment 4 makes it write the scenario
// back after a 400 ms debounce. In a browser that pair is a feature and each
// page load starts from its own URL. In jsdom there is ONE window per test
// FILE, so a test that types a canton and takes longer than the debounce -
// which every axe test does, at about a second each - leaves its scenario in
// the address bar, and the next render in that file seeds itself from it.
//
// MEASURED, NOT INFERRED. A throwaway probe asserted what one test leaves and
// what the next one sees:
//
//   A leaves: "?canton=GE&tt=0&decompte=dj"
//   B starts: same, and its result region already read "Sous les deux seuils
//             ... 0,00 % ... Jours restants avant 40 % 96" instead of
//             "Choisissez votre canton de travail pour lancer le calcul."
//
// That is how nine assertions in accessibility-calculateur.test.tsx started
// failing on a change that touched neither accessibility nor the panel: they
// were looking for a radio in a panel the leaked "methode" had already moved
// past, and for an empty-state sentence a leaked canton had replaced.
//
// WHY HERE RATHER THAN IN THE TWO FILES THAT WENT RED. Nine test files render
// this calculator today and every one of them is now exposed; the two that
// failed are the two that happened to read state the leak changes. Fixing
// those two would leave the other seven passing for a reason nobody chose, and
// the next suite written would inherit the trap silently. The ISOLATION is the
// property, so it belongs where isolation is configured.
//
// This does not paper over a product defect: a real browser gives every page
// load its own URL, and this restores that one guarantee to the test
// environment. What the product does with the URL is asserted directly, in
// url-params.test.tsx and share-controls.test.tsx, both of which set the
// address bar themselves and would keep passing without this file.

import { beforeEach } from 'vitest';

/** Where every DOM test starts. Bare: no query, so nothing is seeded. */
export const CLEAN_URL = '/';

beforeEach(() => {
  // The node environment has no window, and setupFiles run for every test
  // file regardless of its environment comment.
  if (typeof window === 'undefined') return;

  // replaceState, not pushState - a reset that grew the history length would
  // break the very assertion share-controls.test.tsx uses to tell the two
  // apart.
  window.history.replaceState(null, '', CLEAN_URL);
});
