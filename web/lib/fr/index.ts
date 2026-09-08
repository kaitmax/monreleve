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
  heading: 'Combien de jours de télétravail vous reste-t-il ?',
  intro:
    'frontalier calcule votre part de télétravail annuelle et le nombre de jours ' +
    "qu'il vous reste avant les deux seuils qui comptent : celui de l'imposition " +
    'et celui de la sécurité sociale.',
} as const;

/**
 * The title template. Next composes a page's own title into this, and the
 * default is the bare product name for the home route.
 */
export const TITLE_TEMPLATE = `%s — ${APP_NAME}`;
