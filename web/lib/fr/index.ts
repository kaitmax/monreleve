// web/lib/fr/index.ts
// Every user-facing web string lives here. Nothing else declares one.
// French only, one locale, no i18n abstraction (SPEC section 1 non-goals).

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
   * SPEC 14 wants the 40 % threshold named in the description. It is.
   */
  description:
    'Calculez votre part de télétravail annuelle et les jours qui vous ' +
    'restent avant les seuils de 40 % et 49,9 %, puis tenez le registre ' +
    'horodaté de vos journées.',

  intro:
    'frontalier calcule votre part de télétravail annuelle et le nombre de jours ' +
    "qu’il vous reste avant les deux seuils qui comptent : celui de l’imposition " +
    'et celui de la sécurité sociale.',
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
