// web/lib/auth/secret.ts
//
// AUTH_SECRET, read in one place. FW-WEB-ACCOUNT (W12, R206).
//
// TWO READERS, ONE ANSWER. The print token (lib/export/print-token.ts) signs
// with this secret and the website's sign-in seals its step with a key derived
// from it (lib/web-account/step.ts). C9 exported the reader from print-token.ts
// for the second caller; that made the sign-in an importer of the PDF
// pipeline's token module, which takes it out of the set of modules only the
// print page and the export route render through (scripts/gate-selection.mjs,
// containerPdfClosure, R990). A leaf both import keeps one reader without
// that coupling.

import { PLACEHOLDER_SECRET } from '@/lib/deploy/placeholders.mjs';

/**
 * The signing key, or null when there is not one.
 *
 * IT RETURNS NULL RATHER THAN FALLING BACK. R205's shape applied to a key: a
 * route that signs with a default is worse than a route that refuses, because
 * the refusal is visible and the default is not. An unset secret is a
 * deployment that is not finished, and the honest answer is to say so.
 */
export function authSecret(): string | null {
  const value = process.env.AUTH_SECRET;

  if (value === undefined || value === '') return null;
  if (value === PLACEHOLDER_SECRET) return null;

  return value;
}
