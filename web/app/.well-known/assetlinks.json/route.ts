// web/app/.well-known/assetlinks.json/route.ts
//
// GET /.well-known/assetlinks.json - the Digital Asset Links statement that
// makes the sign-in link an Android App Link. FW22 increment 5.
//
// WHAT IT IS FOR. Android verifies this file over HTTPS before it will open a
// link in an app without asking. If it verifies, tapping the magic link opens
// Mon Releve directly; if it does not, the link opens a browser and the
// person sees the JSON from /api/v1/auth/callback, which is the honest
// failure mode described there.
//
// ============================================================================
// UNSET MEANS 404, NEVER AN EMPTY LIST, AND THE DIFFERENCE IS A CLAIM
// ============================================================================
//
// `[]` is not "we have not said yet". It is a COMPLETE AND PUBLISHED
// STATEMENT that no application is associated with this domain - a valid
// answer that Android will read, cache, and act on. Serving it while the real
// fingerprints are simply unknown would publish something false, and it would
// do it in the machine-readable file whose entire purpose is to be believed.
//
// A 404 says what is true: there is no statement here. Android treats the
// absence as unverified, which is exactly the state the product is in until
// AN14 supplies a package name and a signing certificate.
//
// This is the same rule as R160's reviewer chip - "Relecture experte : en
// attente" rather than a name that implies a review nobody did - and the same
// rule as never claiming more than the record supports. It is that rule
// arriving in a JSON file instead of on a page.
//
// ============================================================================
// THE VALUES CANNOT EXIST YET, AND THAT IS EXPECTED
// ============================================================================
//
// ANDROID_PACKAGE_NAME and ANDROID_SHA256_CERT_FINGERPRINTS come from a built,
// signed Android application, which is AN14. Parked as PARK4-2 with what
// AN14 must supply. The seam is here and proven by tests in both states, so
// the day those values exist the change is two environment variables and no
// code.

import { NextResponse } from 'next/server';

/**
 * A SHA-256 certificate fingerprint as Android writes it: 32 bytes of
 * uppercase hex, colon-separated.
 *
 * VALIDATED RATHER THAN TRUSTED. A fingerprint with a typo produces a file
 * that is syntactically fine and verifies against nothing, and the symptom -
 * "the link opens a browser sometimes" - is about as far from the cause as a
 * symptom gets. Refusing to publish a malformed one turns that into a 404 and
 * a log line.
 */
const FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/u;

/** A Java/Kotlin package name, which is what Android matches on. */
const PACKAGE_NAME = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;

function fingerprints(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value !== '');
}

export function GET(): NextResponse {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() ?? '';
  const raw = process.env.ANDROID_SHA256_CERT_FINGERPRINTS?.trim() ?? '';

  if (packageName === '' || raw === '') {
    return NextResponse.json(
      { status: 'not_configured' },
      // 404, and the body is for a human reading curl output. Android reads
      // the STATUS; nothing machine-readable is being asserted here.
      { status: 404 },
    );
  }

  const certs = fingerprints(raw);

  if (!PACKAGE_NAME.test(packageName) || certs.length === 0 || !certs.every((c) => FINGERPRINT.test(c))) {
    console.error(
      '[assetlinks] ANDROID_PACKAGE_NAME or ANDROID_SHA256_CERT_FINGERPRINTS is ' +
        'malformed; refusing to publish a statement that cannot verify.',
    );

    return NextResponse.json({ status: 'not_configured' }, { status: 404 });
  }

  // The shape Android specifies. `delegate_permission/common.handle_all_urls`
  // is the grant that lets the app open our links without asking.
  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: certs,
        },
      },
    ],
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Android re-fetches this; a long cache would make a fingerprint
        // rotation take a day to take effect.
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
}
