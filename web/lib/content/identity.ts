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
 * RULING R301: THE SUITE IDENTIFIES THE INSTANCE, NOT JUST THE PRODUCT.
 *
 * R169 (SERVICE_NAME, above) settles WHAT is answering: /api/health must name
 * this product. It cannot settle WHICH ONE. A sibling instance of this same
 * product - another session's container on the same port, built from a
 * different checkout and holding a different AUTH_SECRET - answers /api/health
 * with service=monreleve and passes R169 cleanly.
 *
 * FW33 ran into exactly that: a sibling container held :3000, the e2e suite
 * reused it, and every live PDF test then got a 503 from print tokens it could
 * not verify - the token this process minted was signed with a key the sibling
 * did not hold. R169 saw the right product and the wrong instance, and the
 * symptom (a 503 on a token) was as far from the cause (the wrong server) as a
 * symptom gets.
 *
 * SO: a harness that starts a server for a live suite sets FRONTALIER_INSTANCE_ID
 * to a value unique to THIS run; the server echoes it from /api/health; and the
 * suite refuses any server that does not echo the value it set.
 *
 * OPT-IN BY CONSTRUCTION. With no expectation set there is no check, so an
 * ordinary `pnpm test:e2e` that reuses a warm server of its own is untouched -
 * which is the whole reason reuseExistingServer is worth keeping (R170). The
 * check bites only when a harness has declared an expectation, which is the one
 * situation in which a sibling can be taken for the subject.
 */
export const INSTANCE_ID_ENV = 'FRONTALIER_INSTANCE_ID';

/**
 * The reason to refuse a server, or null when it may be used.
 *
 * `expected` is the per-run value the harness set (undefined/empty = no
 * expectation, so no check). `found` is whatever /api/health answered in its
 * `instance` field: a string for one of our servers, null for one started
 * without the marker, undefined for a build predating the field - each of which
 * is a server this run did not start, and therefore refused.
 */
export function instanceRefusal(expected: string | undefined, found: unknown): string | null {
  if (expected === undefined || expected === '') return null;
  if (found === expected) return null;

  const shown =
    found === null || found === undefined ? '(no instance marker)' : JSON.stringify(found);

  return `expected the instance this run started (${expected}), but the server answered ${shown}`;
}

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
