// web/lib/fr/index.ts
// Every user-facing web string lives here. Nothing else declares one.
// French only, one locale, no i18n abstraction (SPEC section 1 non-goals).
//
// R172: a sentence about what the product CAN DO takes ProductState as an
// argument, exactly as one naming a threshold takes the formatted figure. The
// flags are facts; this file holds words.

import type { ProductState } from '@/lib/content/product-state';

export const APP_NAME = 'frontalier';

// The workbench: every component, every state. Noindex, out of the sitemap.
export const WORKBENCH_TITLE = 'Composants — workbench';


// ---------------------------------------------------------------------------
// THE PLACEHOLDER HOME (FW10 increment 1). The real homepage is FW20; this
// exists so the public shell is visible and so / is not a blank route while
// the legal pages are built around it.
//
// TODO-COPY: realistic French, not reviewed. It makes the product's claim in
// one sentence and promises nothing the engine cannot compute.
// ---------------------------------------------------------------------------

export const HOME_COPY = {
  heading: 'Combien de jours de télétravail vous reste-t-il ?',

  /**
   * The meta description, and it was MISSING until the increment 6 Lighthouse
   * run said so - SEO 91, "Document does not have a meta description", on the
   * one page the whole SEO strategy points at. The three legal pages each had
   * one; the home page, which FW20 rewrites, had none, and nothing would have
   * noticed.
   *
   * SPEC 14 wants the thresholds named in the description, and they are -
   * but R147 says a figure is never TYPED, so both arrive as arguments,
   * already formatted, exactly as CALCULATEUR_COPY.description takes its own.
   *
   * IT WAS A CONSTANT WITH THE FIGURES IN IT until FW18b, and it is the
   * clearest case the extended scan found: the description of the one page
   * the whole SEO strategy points at, promising two thresholds by value, in a
   * file whose five neighbours each carry a comment explaining why that must
   * not be done.
   *
   * AND IT TOOK THE STATE FOR THE SAME REASON, in FW20b. It ended "puis tenez
   * le registre horodaté de vos journées" - an instruction to use a register
   * that does not exist, on the sentence Google prints under the product's
   * name. It is the FOURTH instance of the defect R172 was issued about and
   * the one FW20's read-through could not have found: a read-through reads
   * pages, and a meta description is never on one.
   */
  description: (fiscal: string, social: string, state: ProductState): string =>
    'Calculez votre part de télétravail annuelle et les jours qui vous ' +
    `restent avant les seuils de ${fiscal} et ${social}` +
    (state.trackerExists ? ', puis tenez le registre horodaté de vos journées.' : '.'),

  intro:
    'frontalier calcule votre part de télétravail annuelle et le nombre de jours ' +
    "qu’il vous reste avant les deux seuils qui comptent : celui de l’imposition " +
    'et celui de la sécurité sociale.',

  /**
   * THE HOME PAGE'S ONE JOB (todo.md): "route to the calculator or the
   * guides", with no hero theatre.
   *
   * TWO DOORS, NOT A FUNNEL. A reader arrives either knowing what they need
   * to compute or not knowing what the rules are, and those want different
   * pages. A single call to action sends the second group into a form they
   * cannot fill.
   *
   * EACH ONE SAYS WHAT IS BEHIND IT AND WHAT IT COSTS IN TIME, because the
   * decision being made here is which of two things to spend the next
   * minute on. "En savoir plus" tells a reader nothing.
   *
   * NO FIGURE (R147), and none is wanted: naming the thresholds is the
   * guides' job and quoting them here would be a third place they live.
   */
  doors: [
    {
      href: '/calculateur-teletravail-frontalier',
      label: 'Calculer mes jours',
      body:
        'Vous savez combien de jours vous avez télétravaillé. Le calculateur ' +
        'vous dit où vous en êtes des deux seuils et combien de jours il vous ' +
        'reste. Une minute, sans inscription.',
    },
    {
      href: '/guides',
      label: 'Comprendre les règles',
      body:
        'Sept guides sur le plafond fiscal, le seuil social, les jours de ' +
        'mission, le droit d’option et le cas genevois. Chaque règle citée ' +
        'renvoie à son texte d’origine.',
    },
  ],
} as const;

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
