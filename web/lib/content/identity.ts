// web/lib/content/identity.ts
//
// RULING R188: THE PRODUCT NAME HAS THREE FORMS AND ONE SOURCE.
//
//   "Mon Relevé"    the name in French prose, headings and the wordmark.
//                   R155 makes the accented form authoritative for copy, so
//                   it lives in lib/fr with the rest of the French.
//   "monreleve.ch"  the domain, unaccented because DNS is.
//   "monreleve"     permitted ONLY where a byte sequence is constrained: the
//                   /api/health service field, package names, CSS class
//                   names, test identifiers, ASCII relay prompts.
//
// THE THIRD FORM IS DERIVED, NOT TYPED. `asciiName` strips the accents off
// APP_NAME rather than declaring "monreleve" beside it, so there is one place
// the product is named and the others are consequences. R181: the text a
// reader sees is derived from the thing it describes, never transcribed
// alongside it - and a second literal is exactly a transcription that is
// correct on the day it is written.
//
// WHY THE DOMAIN IS NOT DERIVED. It is not a spelling of the name, it is a
// registration - a fact about the world that happens to resemble one. Deriving
// `${asciiName(APP_NAME)}.ch` would make a claim about DNS out of a claim
// about French orthography, and the two are free to diverge: the operator
// could hold a different domain tomorrow without the product being renamed.
// So it is its own constant, and R171's rule applies to it rather than to a
// derivation.

import { APP_NAME } from '@/lib/fr';

/**
 * A name reduced to the bytes a constrained context will accept.
 *
 * NFD SPLITS A LETTER FROM ITS ACCENT, and the range below removes the
 * combining marks that fall out - so "é" becomes "e" rather than being
 * dropped. Doing it with a replacement table would be a fourth form of the
 * name, maintained by hand, which is the thing R188 forbids.
 *
 * Everything that is not a letter or a digit goes: the space in "Mon Relevé"
 * is as unwelcome in a package name as the accent is.
 */
export function asciiName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '');
}

/**
 * The name as a byte sequence: /api/health's `service`, the package name, a
 * CSS class, a test identifier.
 *
 * IT IS WHAT R169 COMPARES. The e2e suite refuses to run unless /api/health
 * answers with this exact string, which is why R189 requires the field and
 * the guard to change in one commit - a rename that moved one and not the
 * other would either refuse the right server or accept any server at all.
 */
export const SERVICE_NAME = asciiName(APP_NAME);

/**
 * The domain, unaccented because DNS is.
 *
 * NOT YET REGISTERED, and that is the operator's to do - buying and
 * configuring it is out of scope for this task. What is in scope is that
 * every canonical, hreflang and sitemap entry derives from this one constant
 * rather than carrying a host string of its own (R171).
 */
export const SITE_DOMAIN = 'monreleve.ch';

/** The production origin, for FW28's environment checklist. */
export const PRODUCTION_ORIGIN = `https://${SITE_DOMAIN}`;

/**
 * The origin the test harness configures.
 *
 * RFC 2606 RESERVES .example: it can never resolve, and it cannot be mistaken
 * for the real domain - which matters more now than it did, because the real
 * domain is a thing somebody could accidentally hit.
 *
 * ONE CONSTANT RATHER THAN THE TWELVE LITERALS THIS REPLACED. R171's rule:
 * where a spec means "the origin the build was configured with", it reads
 * that rather than a string that happens to match today. The analytics spec
 * is the reason the rule exists - a hardcoded origin there reclassified our
 * own chunks as third-party the moment the port moved.
 */
export const TEST_ORIGIN = `https://${asciiName(APP_NAME)}.example`;

/**
 * The sending subdomain for transactional mail.
 *
 * A SUBDOMAIN RATHER THAN THE APEX, and lib/fr/emails.ts already argued why:
 * SPF and DKIM records for a sending subdomain can change without touching
 * the records the apex uses for everything else, so a deliverability problem
 * stays contained. The DNS records are an operator task (FW28).
 *
 * It is here rather than in lib/fr because it is a host, not copy - the same
 * split R188 draws between the accented name and the domain.
 */
export const MAIL_SUBDOMAIN = `notifications.${SITE_DOMAIN}`;
