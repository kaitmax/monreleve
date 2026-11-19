// web/lib/web-account/paths.ts
//
// Every address inside the account area, built from ACCOUNT_PATH so that each
// one is inside the cookie's Path by construction (R900). A handler or a form
// names these constants, never a typed string.

import { ACCOUNT_PATH, ACCOUNT_SIGN_IN_PATH } from '@/lib/content/routes';

export const ACCOUNT_PATHS = {
  /** The signed-in page. Signed out, it sends the person to `signIn`. */
  home: ACCOUNT_PATH,
  /** Step one, the address (GET, a page). */
  signIn: ACCOUNT_SIGN_IN_PATH,
  /** Step one's form target (POST). */
  send: `${ACCOUNT_PATH}/connexion/envoi`,
  /** Step two, the code (GET, a page). */
  code: `${ACCOUNT_PATH}/connexion/code`,
  /** Step two's form target (POST). */
  verify: `${ACCOUNT_PATH}/connexion/verification`,
  /** Sign-out (POST only - a GET that ends a session is a CSRF target). */
  signOut: `${ACCOUNT_PATH}/deconnexion`,
  /** The year's PDF (POST: it records an issuance, so it is state-changing - R902). */
  exportPdf: `${ACCOUNT_PATH}/export/pdf`,
  /** The year's days as CSV (POST, for one rule across the area). */
  exportCsv: `${ACCOUNT_PATH}/export/csv`,
} as const;

/** The query parameter names the area uses, one home each. */
export const ACCOUNT_PARAMS = {
  /** The address page's reason for being shown again. */
  state: 'etat',
  /** The sealed address carried from step one to step two. */
  step: 'etape',
  /** The code page's reason for being shown again. */
  error: 'erreur',
  /** The signed-in page's note that a download was refused. */
  export: 'export',
} as const;

/** The year: the download forms' field (the page reads no year from its URL - Web Ruling 32). */
export const YEAR_FIELD = 'annee';

/** The form field names, which the handlers read and the pages render. */
export const ACCOUNT_FIELDS = {
  email: 'adresse',
  code: 'code',
  step: 'etape',
} as const;

/** A path with a query, assembled safely (the host never appears - R364). */
export function withQuery(path: string, query: Readonly<Record<string, string>>): string {
  const search = new URLSearchParams(query).toString();

  return search === '' ? path : `${path}?${search}`;
}
