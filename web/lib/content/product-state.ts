// web/lib/content/product-state.ts
//
// RULING R172: STATEMENTS ABOUT THE PRODUCT'S OWN STATE COME FROM ONE MODULE.
//
// THE DEFECT THAT PRODUCED IT. FW20 wrote three pages in one task. Each was
// internally consistent, every test passed, and the contradiction lived only
// BETWEEN them:
//
//   /a-propos        "Ce site calcule une part de teletravail ET TIENT UN
//                     REGISTRE DE JOURNEES"
//   /tarifs          "Le calculateur, les guides ET LE RELEVE sont gratuits"
//   /releve-annuel   "Le registre journalier et le document qui en decoule
//                     NE SONT PAS CONSTRUITS"
//
// Two pages asserted what the third denied. No test could see it, because
// each page is right about itself - the same shape as the P-register
// collision that R162 was issued about, one subject over. The read-through
// caught it, and the read-through is a person reading, which does not scale
// to every future page.
//
// SO THE FACTS LIVE HERE AND THE PAGES DERIVE. A flag flips once and every
// page that depends on it changes together, the way the footer's review date
// derives from LAST_REGULATORY_REVIEW rather than being typed on each page.
//
// EACH FLAG NAMES THE TASK THAT FLIPS IT, so a reader of this file can tell
// "not yet" from "nobody has looked". A boolean with no owner is a boolean
// that stays false because everybody assumes somebody else is watching it.
//
// A PAGE EXISTING IS NOT THE THING EXISTING, and /releve-annuel is the case
// that proves the distinction is load-bearing. Its route is `live` and has
// been since FW20: there is a page, a reader can reach it, it is in the
// sitemap. The DOSSIER it describes does not exist - no data model, no API,
// no PDF route. `dossierExists` is false while the route is live, and
// anything that reads the route registry to decide what to claim would get
// this exactly backwards.

/**
 * What the product can actually do today, as facts rather than as prose.
 *
 * VERIFIED AGAINST THE CODE, not against intention. The comment on each flag
 * names the evidence that settles it, so flipping one is a check somebody can
 * repeat rather than a judgement they have to trust.
 */
export interface ProductState {
  /** The telework calculator: a reader enters days and gets a rate. */
  readonly calculatorExists: boolean;
  /** The seven SPEC 9.5 articles. */
  readonly guidesExist: boolean;
  /** The regulatory-change alert list. */
  readonly alertsExist: boolean;
  /** A day-by-day record with server-assigned timestamps (SPEC 8). */
  readonly trackerExists: boolean;
  /** The Releve annuel de teletravail itself - the PDF (SPEC 12). */
  readonly dossierExists: boolean;
  /** The LAMal/CMU cost comparator (SPEC 9.6). */
  readonly comparatorExists: boolean;
  /** The Android application (the AN series). */
  readonly appExists: boolean;
}

export const PRODUCT_STATE: ProductState = {
  // BUILT, FW11. app/(public)/calculateur-teletravail-frontalier/ renders a
  // form and lib/calc-engine computes from it; the Geneva fixtures pass.
  calculatorExists: true,

  // BUILT, FW17 and FW18. Seven articles in content/guides/, all `live` in
  // the route registry and all in the sitemap.
  guidesExist: true,

  // BUILT, FW14. app/api/alertes/ accepts a subscription and AlertSubscriber
  // is the one model prisma/schema.prisma declares. Delivery is degraded
  // without RESEND_API_KEY, which is a configuration state rather than an
  // existence one - the feature is here.
  alertsExist: true,

  // NOT BUILT. FW21 added Entry, EntryEvent and the triggers that make them
  // evidence - AND THAT CHANGES NOTHING HERE, which is the whole point of
  // R186. A table is not a tracker: nobody can record a day until an API
  // (FW23), a client and a release exist. The proxy is a released Android
  // client under android/, not a model in the schema.
  //
  // THIS COMMENT USED TO NAME THE SCHEMA as its evidence - "there is no Entry
  // model ... prisma/schema.prisma declares AlertSubscriber and nothing else"
  // - and FW21 made that sentence false while the flag stayed correctly
  // false. The test had already been retargeted, so nothing failed: the value
  // was right, the guard was right, and the reason a reader was given for the
  // value was four commits out of date. An evidence comment is part of the
  // claim, and it goes stale exactly where nothing executes it.
  // Flipped by: the AN series, at AN14.
  trackerExists: false,

  // NOT BUILT, and /releve-annuel being `live` does not change that - see the
  // module comment. SPEC 12's document needs the tracker beneath it plus a
  // print route; app/releve/ does not exist, and R53 reserves /releve/print
  // for a route nobody has written.
  // Flipped by: the FW2x backend series, after trackerExists.
  dossierExists: false,

  // NOT BUILT. /calculateur-lamal-cmu is `planned` in the registry, and FW19
  // reached R157 option (3) - no UI at all - because the premium data is
  // unlicensed. PARK-4.
  // Flipped by: whichever task resolves the licence question.
  comparatorExists: false,

  // NOT BUILT. android/ exists (AN1) but its release buildType is unsigned -
  // nobody outside this machine can install it. The comment used to name
  // "there is no android/ directory" as the evidence; AN1 creating that
  // directory made the comment false while the flag stayed correctly false,
  // which is the exact FW21 staleness class this module's header documents.
  // Flipped by: the AN series, at the release task (provisional - see
  // tests/unit/content/product-state.test.ts EVIDENCE.appExists).
  appExists: false,
};
