// web/lib/content/route-paths.ts
//
// THE PATHS CLIENT CODE NEEDS, AND NOTHING ELSE (FW-CALC-BYTES, R976).
//
// A LEAF: IT IMPORTS NOTHING. lib/content/routes.ts holds the registry - every
// public URL with its status, gate, task and sitemap weight - and a client
// module that imported a path from there shipped all of it. The calculator's
// form imported RESULT_PATH that way, so every registered route reached the
// browser on the page with the least GATE A headroom (QUEUE-STATE BLOCKED 11).
//
// ONE HOME, STILL (R206). routes.ts imports these constants, declares its
// routes with them and re-exports them, so the registry remains where a route
// is declared and every existing `from '@/lib/content/routes'` keeps working.
// A client module imports from HERE instead. tests/unit/content/route-paths.test.ts
// asserts both halves: this file imports nothing, and routes.ts spells none of
// these paths itself.

/**
 * The calculator's slug, exported because it appears in the registry, the
 * route directory, the nav, the page's metadata and three test files - and
 * SPEC 14 makes it permanent once published, so it is the last string in this
 * product that should be typed twice.
 */
export const CALCULATOR_PATH = '/calculateur-teletravail-frontalier';

/**
 * The server-rendered result, and its path is FROZEN (R351, authorised by the
 * operator with the ruling).
 *
 * WHY IT IS ITS OWN ROUTE rather than the calculator answering for itself.
 * FW13 increment 2 measured that ANY use of searchParams on the calculator -
 * in the page or in generateMetadata, even behind a Suspense boundary - makes
 * that route dynamic and emits <title> and the canonical into the BODY. This
 * is SPEC 14's target-query page, and AC3's noindex would land in the body
 * too, where it is ignored, leaving param URLs indexable. So the calculator
 * stays static exactly as FW13 built it, and the computing happens here.
 *
 * FROZEN MEANS WHAT SPEC 14 MEANS BY IT: a form's action is a published
 * address the moment a reader bookmarks where it lands, so renaming this
 * costs a 301 forever. tests/unit/content/result-path.test.ts asserts the
 * literal, so a rename is a deliberate act with a failing test in front of it
 * rather than a refactor nobody noticed.
 *
 * DELIBERATELY ABSENT FROM PUBLIC_ROUTES. The sitemap is generated from that
 * registry and this page must never appear in it: it holds no content of its
 * own, only an answer to someone's figures. Its noindex arrives as
 * middleware's X-Robots-Tag, UNCONDITIONALLY - not on the calculator's "only
 * when there is a query" rule, because even this path's bare form is a
 * parameterised view.
 */
export const RESULT_PATH = `${CALCULATOR_PATH}/resultat`;

/** The LAMal / CMU comparator's slug (SPEC 9.6), for the same reason as CALCULATOR_PATH. */
export const COMPARATOR_PATH = '/calculateur-lamal-cmu';
