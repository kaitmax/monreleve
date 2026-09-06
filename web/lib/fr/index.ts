// web/lib/fr/index.ts
// Every user-facing web string lives here. Nothing else declares one.
// French only, one locale, no i18n abstraction (SPEC section 1 non-goals).

export const APP_NAME = 'frontalier';

// The workbench: every component, every state. Noindex, out of the sitemap.
export const WORKBENCH_TITLE = 'Composants — workbench';

// A French-formatted figure used to prove tabular numerals are active
// (FW1 AC1). U+202F is the narrow no-break space the day formatter uses
// (SPEC section 6.4). Not product copy; the real formatters arrive in FW6.
export const TABULAR_PROOF_FIGURE = '1 234,5';
