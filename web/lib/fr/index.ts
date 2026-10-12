// web/lib/fr/index.ts
// Every user-facing web string lives here. Nothing else declares one.
// French only, one locale, no i18n abstraction (SPEC section 1 non-goals).
//
// R172: a sentence about what the product CAN DO takes ProductState as an
// argument, exactly as one naming a threshold takes the formatted figure. The
// flags are facts; this file holds words.

/**
 * THE PRODUCT NAME, accented, and the single source R188 names.
 *
 * "Mon Relevé" is the name in French prose, in headings and in the
 * wordmark. R155 makes the accented form authoritative for copy, which is
 * why it lives here rather than in lib/content beside the domain.
 *
 * THE OTHER TWO FORMS ARE CONSEQUENCES OF THIS ONE. lib/content/identity.ts
 * derives the byte-constrained spelling - "monreleve", for /api/health, the
 * package name and test identifiers - by stripping the accents off this
 * string rather than declaring a second literal beside it. A second literal
 * is a transcription, correct on the day it is written (R181).
 *
 * IT WAS "frontalier" UNTIL FW20c, which was also the French common noun for
 * the reader this product is built for - a frontalier is a cross-border
 * worker. The copy is full of the word in that sense and stays that way; the
 * rename is of the PRODUCT, not of the vocabulary, and SPEC 14 freezes the
 * slugs that carry the word as a URL.
 */
export const APP_NAME = 'Mon Relevé';

// The workbench: every component, every state. Noindex, out of the sitemap.
export const WORKBENCH_TITLE = 'Composants — workbench';


// ---------------------------------------------------------------------------
// THE HOME PAGE (FW34). Its copy lives in lib/fr/home.ts - a dedicated module
// per page, the way calculateur.ts and sources.ts are. Import it directly:
// `import { HOME_COPY } from '@/lib/fr/home'`.
//
// NOT RE-EXPORTED HERE, and the reason is a build error, not a preference.
// home.ts imports APP_NAME from this barrel (home -> index); re-exporting
// HOME_COPY from home would close the loop (index -> home -> index), and
// webpack's production bundling hoisted the two into a temporal-dead-zone
// "Cannot access 'd' before initialization" when /api/health pulled the chain
// in. One direction only - home depends on the barrel, the barrel on nothing.
// ---------------------------------------------------------------------------

/**
 * The title template. Next composes a page's own title into this, and the
 * default is the bare product name for the home route.
 */
export const TITLE_TEMPLATE = `%s — ${APP_NAME}`;

// ---------------------------------------------------------------------------
// THE 404 (FW10 increment 4).
//
// NO "OUPS", no apology and no illustration - the prompt is explicit, and it
// is right: a reader who mistyped an address wants the way out, not a joke
// about it. One sentence saying what happened, and two links that go
// somewhere useful.
//
// It says "peut-etre" because the page genuinely does not know which of the
// two happened, and guessing would be the same overclaiming this product
// avoids everywhere else.
//
// TODO-COPY: realistic French, not reviewed.
// ---------------------------------------------------------------------------

export const NOT_FOUND_COPY = {
  heading: "Cette page n’existe pas",
  body:
    'Le lien que vous avez suivi est peut-être ancien, ou son adresse ' +
    'comporte une erreur.',
  calculator: 'Aller au calculateur',
  calculatorHref: '/calculateur-teletravail-frontalier',
  home: "Revenir à l’accueil",
  homeHref: '/',
} as const;
