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
//
// ---------------------------------------------------------------------------
// R172: THE TIMESTAMP CLAUSE IS CONDITIONAL, and this is the worst instance
// the product-state audit found.
//
// PublicShell.tsx:260 renders this sentence in the footer of EVERY public
// page. One of those pages is /releve-annuel, whose body says the day
// register is not built - so the footer contradicted the article above it ON
// THE SAME RENDER, which is R172's defect collapsed from three pages onto
// one. It shipped in FW20 alongside the very page it contradicts, and the
// read-through that found the other three did not see it, because a footer is
// furniture a reader stops reading.
//
// SPEC'S WORDING IS PRESERVED EXACTLY in the state SPEC describes. SPEC 12's
// item 6 specifies this footer for THE DOCUMENT - "each entry carries a
// server recording timestamp" - and a document is a thing that has entries.
// The clause is therefore true whenever there is a register, and the branch
// below says nothing SPEC does not, in the state SPEC was written about.
//
// AND R165 ALREADY COVERED IT. The site footer took the DOCUMENT's sentence
// unchanged, which is the lifted-copy defect exactly: one constant rendered
// in several places has to be true in all of them. The document's footer will
// be true the day the document exists; the site's was not.
//
// NO PROP, STILL. The branch reads PRODUCT_STATE at the call site, not a
// caller's argument - the seam LegalNote.tsx refuses is a CALLER choosing the
// wording, and a fact module is not a choice.
// ---------------------------------------------------------------------------

import type { ProductState } from '@/lib/content/product-state';

/**
 * The clause SPEC 12 item 6 specifies: "each entry carries a server recording
 * timestamp".
 *
 * ONE DECLARATION, TWO SURFACES, which is what keeps R183's two strings from
 * becoming two WORDINGS. R84's census counts occurrences of a constant; this
 * is the same discipline one level down, on the sentence inside it.
 */
const TIMESTAMP = 'Chaque jour enregistré est horodaté par le service. ';

const OPENING =
  'Estimation fournie à titre indicatif, sur la base des jours que vous ' +
  'avez déclarés. ';

const ADVICE =
  'Ce document ne constitue pas un conseil fiscal et n’engage ni ' +
  'l’administration française ni l’administration suisse.';

// ---------------------------------------------------------------------------
// RULING R183: THE SITE FOOTER AND THE DOCUMENT FOOTER CARRY DIFFERENT
// STRINGS.
//
// SPEC 12 item 6 specifies the timestamp sentence for THE DOCUMENT, where it
// is always true - there is no way to be an entry in an exported dossier
// without carrying a server timestamp. SPEC 17.6 put the same $legal-01 token
// in the SITE footer, where the identical sentence is a claim about a PRODUCT
// STATE, and that claim was false on every public page from FW8 to FW20b.
//
// IT SUPERSEDES FW20b'S FIX (PARK-14), which made the single shared string
// conditional. That was right about the defect and wrong about the remedy:
// one constant rendered on two surfaces has to be true on both, and the
// honest answer is two constants rather than a branch. R165's lifted-copy
// rule, arriving on a legal string - copy retrofitted across surfaces is
// authored per instance, never taken from one and reused.
//
// THE DOCUMENT'S IS UNCONDITIONAL AND THAT IS THE HALF EASY TO LOSE. Making
// both conditional would be tidier and would be wrong: a dossier omitting the
// sentence would understate what it actually carries, and SPEC 12 fixes the
// wording.
// ---------------------------------------------------------------------------

export const LEGAL_COPY = {
  /**
   * $legal-01 on the SITE: every public page's footer, and the result panel.
   *
   * Conditional, because the timestamp clause is a claim about a register
   * this product does not yet have. PublicShell.tsx renders this on
   * /releve-annuel, whose body says the register is not built - the
   * contradiction FW20b found on a single render.
   */
  standing: (state: ProductState): string =>
    OPENING + (state.trackerExists ? TIMESTAMP : '') + ADVICE,

  /**
   * $legal-01 on the DOCUMENT: SPEC 12 item 6's footer, verbatim.
   *
   * NOT A FUNCTION, deliberately. The state that would make the clause false
   * is a state in which the document cannot be produced at all, so there is
   * no branch to take - and giving this the site's signature "for
   * consistency" is precisely the edit R183 exists to refuse.
   *
   * NOTHING RENDERS IT YET. SPEC 12's document is unbuilt - PRODUCT_STATE
   * .dossierExists is false, app/releve/ does not exist, and R53 reserves
   * /releve/print for a route nobody has written. It is declared here so the
   * task that builds the document finds the sentence already decided, the way
   * R53 reserves the route.
   */
  documentStanding: OPENING + TIMESTAMP + ADVICE,
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
