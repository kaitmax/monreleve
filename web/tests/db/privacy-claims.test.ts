// web/tests/db/privacy-claims.test.ts
//
// FW14 AC3: EVERY /confidentialite CLAIM ABOUT THE ALERT LIST, MAPPED TO THE
// TEST THAT MAKES IT TRUE.
//
// WHY THIS IS THE ACCEPTANCE CRITERION AND NOT A CHORE. /confidentialite
// shipped in FW10 describing behaviour that did not exist yet - there was no
// database, so every sentence about what happens to an address was a
// description of intent. FW14 is where that description has to become true,
// and "a published claim that is not true of the code is the one outcome this
// task may not produce".
//
// EACH CLAIM IS ASSERTED TWICE, which is the part that makes this durable:
//
//   THE PAGE still says it. Otherwise the copy could be softened until the
//   code happens to satisfy it, which is passing the exam by editing the
//   question.
//   THE CODE still does it. Otherwise the page is a promise nothing keeps.
//
// Either half alone rots. Together, a change to one fails on the other.
//
// ONE CLAIM WAS CORRECTED RATHER THAN IMPLEMENTED, and AC3 explicitly allows
// that: the legal-basis line said every consent is withdrawn "dans les
// paramètres de l'application", which is true of the reminder and of
// automatic detection and NOT of the alert list - anybody can join that from
// the public site without installing anything. A web subscriber wanting out
// would have been sent looking for a setting in an app they do not have. The
// list has always been leavable by the link in every message; the page now
// says so.

import { TEST_ORIGIN } from '../../lib/content/identity';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/alertes/route';
import { GET as exportRoute } from '@/app/api/v1/account/export/route';
import { POST as deleteRoute } from '@/app/api/v1/account/delete/route';
import { PATCH as mePatch } from '@/app/api/v1/me/route';
import { issueTokenPair } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db/client';
import {
  CONFIDENTIALITE_COPY,
  DISCLOSED_RECORDS,
  WEB_STATEMENTS,
} from '@/lib/fr/confidentialite';
import { ALERTES_COPY } from '@/lib/fr/alertes';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { confirmByToken, unsubscribeByToken } from '@/lib/alerts/confirm';
import { recordSubscription } from '@/lib/alerts/record';
import { purgeUnconfirmed, PURGE_AFTER_DAYS } from '@/lib/alerts/purge';
import { resetRateLimit } from '@/lib/alerts/rate-limit';

/** Written once: a literal escape in a heredoc has bitten this session three times. */
const NEWLINE = String.fromCharCode(10);

// R171: the origin is a ROLE - "what the build was configured with" - and
// FW20c made it one constant. It was a literal in thirteen files, which is
// twelve chances for a rename to leave one behind pointing at a host that
// no longer means anything.
const ORIGIN = TEST_ORIGIN;
const EMAIL = 'lecteur@example.com';

beforeEach(async () => {
  await prisma.alertSubscriber.deleteMany();
  clearOutbox();
  resetRateLimit();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function subscribePost(email: string): NextRequest {
  return new NextRequest(`${ORIGIN}/api/alertes`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': '1.2.3.4',
    },
    body: new URLSearchParams({ email, source: 'calculateur' }).toString(),
  });
}

/** Every sentence on the page, flattened, so a claim can be located in it. */
const pageText = (): string =>
  [
    ...CONFIDENTIALITE_COPY.web,
    ...CONFIDENTIALITE_COPY.basis,
    ...CONFIDENTIALITE_COPY.retention,
  ].join(' ');

describe('CLAIM 1: the public site sets no cookie and asks for no account', () => {
  it('is still on the page', () => {
    expect(WEB_STATEMENTS.noCookies).toContain('aucun cookie');
    expect(WEB_STATEMENTS.noCookies).toContain('aucun compte');
  });

  it('holds: subscribing sets no cookie', async () => {
    const response = await POST(subscribePost(EMAIL));

    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('holds: no row carries anything but an address, a source and dates', async () => {
    // "ne vous identifie pas". The columns ARE the claim: there is no name,
    // no IP, no user agent and no identifier of any kind, so there is nothing
    // to identify anybody with even by accident.
    await POST(subscribePost(EMAIL));

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(Object.keys(row).sort()).toEqual([
      'confirmationExpiresAt',
      'confirmationTokenHash',
      'confirmedAt',
      'createdAt',
      'email',
      'id',
      'source',
      'unsubscribeTokenHash',
      'unsubscribedAt',
    ]);
  });
});

describe('CLAIM 2: an address is recorded only if the reader gives it', () => {
  it('is still on the page, in the two halves FW22 split it into', () => {
    // FW14 asserted one word - "uniquement si vous la donnez" - because the
    // sentence made ONE claim. FW22 split it: the closed PURPOSE was falsified
    // by sign-in, so the page now leads with how many cases there are and then
    // names each. The claim is unchanged and is made in two places, so it is
    // asserted in two places rather than loosened to match whichever half
    // still happens to contain the old phrase.
    expect(WEB_STATEMENTS.twoCases).toContain('jamais');
    expect(WEB_STATEMENTS.twoCases).toContain('sans une action de votre part');
    expect(DISCLOSED_RECORDS.alertList).toContain('si vous donnez votre adresse');
  });

  it('holds: no row exists until a POST carries an address', async () => {
    expect(await prisma.alertSubscriber.count()).toBe(0);

    // A rejected address writes nothing either - so a typo does not leave a
    // record of somebody who never subscribed.
    await POST(subscribePost('pas-une-adresse'));

    expect(await prisma.alertSubscriber.count()).toBe(0);

    await POST(subscribePost(EMAIL));

    expect(await prisma.alertSubscriber.count()).toBe(1);
  });
});

describe('CLAIM 3: a confirmation link is sent', () => {
  it('is still on the page', () => {
    expect(DISCLOSED_RECORDS.alertList).toContain('lien de ');
    expect(DISCLOSED_RECORDS.alertList).toContain('confirmation');
  });

  it('holds: the message goes out, and the address is not on the list until it is opened', async () => {
    await POST(subscribePost(EMAIL));

    expect(readOutbox()).toHaveLength(1);

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    // THE DOUBLE OPT-IN, as a property rather than as a flow: the row exists
    // and is NOT confirmed. Anything that treated an unconfirmed row as a
    // subscriber would make this claim false without changing a word of it.
    expect(row.confirmedAt).toBeNull();
  });
});

describe('CLAIM 4: the date of the reader agreement is recorded', () => {
  it('is still on the page', () => {
    expect(DISCLOSED_RECORDS.alertList).toContain('la date de votre accord');
  });

  it('holds: confirming stamps confirmedAt', async () => {
    const { token } = await recordSubscription({ email: EMAIL, source: 'calculateur' });

    expect(await confirmByToken(String(token))).toBe('confirmed');

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(row.confirmedAt).toBeInstanceOf(Date);
  });
});

describe('CLAIM 5: every message carries a one-click unsubscribe', () => {
  it('is still on the page', () => {
    expect(DISCLOSED_RECORDS.alertList).toContain('désinscription en un clic');
  });

  it('holds: the link is in the message, and it works', async () => {
    await POST(subscribePost(EMAIL));

    const text = String(readOutbox()[0]?.text);

    expect(text).toContain(ALERTES_COPY.unsubscribe.emailLink);

    const link = text
      .split('\n')
      .find((line) => line.includes('/api/alertes/desinscription'));
    const token = new URL(String(link)).searchParams.get('token');

    expect(await unsubscribeByToken(String(token))).toBe('unsubscribed');
  });
});

describe('CLAIM 6: consent is the basis, and it is withdrawable', () => {
  it('is still on the page, and now says WHERE for the alert list', () => {
    // THE CORRECTED SENTENCE. It used to send every withdrawal to the app's
    // settings, which a web subscriber does not have.
    const basis = CONFIDENTIALITE_COPY.basis.join(' ');

    expect(basis).toContain('Votre consentement, pour les alertes');
    expect(basis).toContain('lien de désinscription');
  });

  it('holds: the alert list can be left without an account or an app', async () => {
    // Nothing in this path touches authentication, and there is none to
    // touch: the whole loop is an address and two links.
    await POST(subscribePost(EMAIL));

    const text = String(readOutbox()[0]?.text);
    const link = text
      .split('\n')
      .find((line) => line.includes('/api/alertes/desinscription'));

    expect(await unsubscribeByToken(String(new URL(String(link)).searchParams.get('token')))).toBe(
      'unsubscribed',
    );

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(row.unsubscribedAt).toBeInstanceOf(Date);
  });
});

describe('CLAIM 7: an unconfirmed subscription is deleted after thirty days', () => {
  it('is still on the page, with that number', () => {
    expect(CONFIDENTIALITE_COPY.retention[0]).toContain('30 jours');
    expect(CONFIDENTIALITE_COPY.retention[0]).toContain('non confirmée');
  });

  it('holds: the purge removes it, and the constant is the same 30', async () => {
    expect(PURGE_AFTER_DAYS).toBe(30);

    await prisma.alertSubscriber.create({
      data: {
        email: EMAIL,
        source: 'calculateur',
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      },
    });

    expect(await purgeUnconfirmed()).toBe(1);
  });
});

describe('CLAIM 8: technical reports carry no addresses', () => {
  it('is still on the page', () => {
    expect(CONFIDENTIALITE_COPY.retention[3]).toContain('rapports techniques');
    expect(CONFIDENTIALITE_COPY.retention[3]).toContain('adresses e-mail');
  });

  it('holds: nothing in the alert code logs an address', () => {
    // FW14 IS THE FIRST TASK THAT COULD BREAK THIS CLAIM, because it is the
    // first that handles an address at all. It produces no error reports -
    // GlitchTip is FW28's - but it does log: the mailer reports a provider
    // refusal, and a refusal naturally carries the address it refused.
    //
    // A SOURCE SCAN, and the limits are worth stating. It reads the console
    // calls in lib/alerts and requires none of them to mention an address
    // or a message body. That cannot prove a future call site is safe; it
    // can fail the moment somebody adds an unsafe one, which is what a
    // published claim needs.
    const sources = [
      'lib/alerts/mailer.ts',
      'lib/alerts/record.ts',
      'lib/alerts/confirm.ts',
      'lib/alerts/rate-limit.ts',
      'lib/alerts/purge.ts',
      'app/api/alertes/route.ts',
    ];

    const offenders: string[] = [];

    for (const file of sources) {
      const text = readFileSync(join(process.cwd(), file), 'utf8');

      for (const line of text.split(NEWLINE)) {
        const code = line.split('//')[0] ?? '';

        if (!code.includes('console.')) continue;

        // The address, the body, or the whole message object.
        //
        // PLAIN STRING CHECKS RATHER THAN A REGEX, and the reason is a defect
        // this file carried for one run: a word-boundary escape written
        // through a shell arrived as a literal BACKSPACE character, so the
        // pattern silently became something else. eslint no-control-regex is
        // what caught it. There is nothing here a regex does better.
        const LEAKS = ['email', 'message.', '.text', '.to', 'subscription'];

        if (LEAKS.some((fragment) => code.includes(fragment))) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('found console calls at all, so the scan is not vacuous', () => {
    // R63. The mailer logs twice on purpose - a missing key and a provider
    // refusal - so a scan finding nothing would mean it stopped reading the
    // file rather than that the file is clean.
    const mailer = readFileSync(join(process.cwd(), 'lib/alerts/mailer.ts'), 'utf8');
    const calls = mailer.split(NEWLINE).filter((line) => line.includes('console.'));

    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('R138: a claim with no code behind it is in the future tense', () => {
  it('says the site does not measure anything YET', () => {
    // THE POINT OF THE RULING. A present-tense sentence describing
    // analytics that do not exist is a published claim nothing enforces -
    // the same shape as the consent sentence FW14 corrected, and live
    // today on a page about privacy.
    expect(WEB_STATEMENTS.analytics).toContain('ne mesure pas encore');
  });

  it('makes no present-tense promise about how it measures', () => {
    // THE GUARD THAT OUTLIVES THIS TASK. Whoever flips this to the present
    // maps it to its test in the same increment; until then, flipping it
    // fails HERE. So the mapping cannot be forgotten on the way.
    //
    // FW15 WAS EXPECTED TO BE THAT TASK AND WAS NOT, which is recorded here
    // rather than left as a prediction that quietly stopped being true.
    // SPEC 15 asks for Umami, self-hosted, with a same-origin script, and
    // FW15 measured that it cannot be served that way yet: there is no
    // running instance to proxy or copy from (FW28 deploys one), no npm
    // package to vendor (@umami/browser and umami-browser are both 404,
    // @umami/node is a server-side client), and committing a copy of a
    // third-party script is an ask-first item under SPEC 20 that nothing
    // here could verify against upstream.
    //
    // So the claim was not made true, and under R138 that means the
    // sentence stays rather than the claim widening to meet it. What FW15
    // added instead is e2e/analytics.spec.ts, which holds the half of the
    // sentence that IS about today - "ne mesure pas encore" - on every
    // public route.
    const claim = WEB_STATEMENTS.analytics;

    expect(claim).not.toContain('est auto-hébergée');
    expect(claim).not.toContain('Elle compte les pages');
    expect(claim).not.toContain('ne part vers un tiers');
  });

  it('still describes what it WILL do, rather than saying nothing', () => {
    // Non-vacuity: deleting the sentence would satisfy both assertions
    // above and tell the reader less than the page told them before.
    const claim = WEB_STATEMENTS.analytics;

    expect(claim).toContain('auto-hébergée');
    expect(claim).toContain('sans cookie');
    expect(claim).toContain('tiers');
  });
});

describe('the map covers the page rather than a chosen part of it', () => {
  it('names every alert-list sentence the page carries', () => {
    // R63, applied to a privacy map. The seven claims above are worth
    // nothing if an EIGHTH sentence about the alert list exists on the page
    // and nobody noticed. This finds every sentence that mentions the list
    // and requires it to be one this file has taken a position on.
    const MAPPED = [
      WEB_STATEMENTS.noCookies,
      DISCLOSED_RECORDS.alertList,
      CONFIDENTIALITE_COPY.basis[1],
      CONFIDENTIALITE_COPY.retention[0],
      CONFIDENTIALITE_COPY.retention[3],

      // FW22. The filter below catches any sentence mentioning "e-mail", and
      // the split introduced two more. Both are owned:
      //   twoCases    asserted by CLAIM 2 above, in its two halves.
      //   signInLink  asserted by tests/unit/content/personal-data.test.ts,
      //               which maps VerificationToken's three columns to it and
      //               requires it rendered.
      WEB_STATEMENTS.twoCases,
      DISCLOSED_RECORDS.signInLink,
    ];

    /**
     * Sentences this task does not own, named rather than filtered away.
     *
     * The analytics claim was FW15's to make true, and FW15 could not: the
     * measurement is in the R138 block above. FW14 found the sentence while
     * proving the alert-list claims and could not map it to a test, because
     * there was no code to test - nothing on this site measures anything.
     *
     * RULING R138 put it in the FUTURE TENSE rather than leaving a
     * present-tense claim standing with nothing behind it. It is listed
     * HERE rather than excluded by a narrower filter, because a filter that
     * quietly stopped matching it would be indistinguishable from nobody
     * having noticed it.
     *
     * IT IS NO LONGER UNMAPPED, though. e2e/analytics.spec.ts asserts the
     * present-tense half of the sentence on every public route: no analytics
     * script, no cookie, no third-party request. The future-tense half is
     * still a promise, and stays one until a task ships the measurement.
     */
    const NOT_THIS_TASK = [WEB_STATEMENTS.analytics];

    const mentionsAlerts = [
      ...CONFIDENTIALITE_COPY.web,
      ...CONFIDENTIALITE_COPY.basis,
      ...CONFIDENTIALITE_COPY.retention,
    ].filter(
      (sentence) =>
        sentence.includes('alerte') ||
        sentence.includes('e-mail') ||
        sentence.includes('cookie'),
    );

    for (const sentence of mentionsAlerts) {
      expect(
        [...MAPPED, ...NOT_THIS_TASK],
        sentence.slice(0, 60),
      ).toContain(sentence);
    }

    // And the unowned list is not a place to quietly retire claims: it
    // holds exactly the one, and the report names it.
    expect(NOT_THIS_TASK).toHaveLength(1);
  });

  it('found sentences at all, so the filter above is not empty', () => {
    expect(pageText()).toContain('alerte');
    expect(pageText().length).toBeGreaterThan(500);
  });
});

// ============================================================================
// FW26: THE ACCOUNT HALF OF THE PAGE BECOMES TRUE
// ============================================================================
//
// FW14 made the alert-list claims true. These four have described an account
// that could not yet be exported or deleted - a description of intent, exactly
// as the alert-list sentences were before FW14. Each is now bound to the code
// that makes it so, in the same two halves: the page still says it, and the
// code still does it.

/** A fresh account with one logged day, its trail, and a live token. */
async function accountWithData(email: string): Promise<{ userId: string; token: string }> {
  const user = await prisma.user.create({
    data: { email, name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
  });

  const entry = await prisma.entry.create({
    data: {
      userId: user.id,
      dayDate: new Date('2026-03-02T00:00:00.000Z'),
      portion: 'FULL',
      kind: 'HOME',
      clientMutationId: `00000000-0000-4000-f000-${Date.now().toString().slice(-12)}`,
    },
  });

  await prisma.entryEvent.create({
    data: {
      userId: user.id,
      entryId: entry.id,
      action: 'CREATED',
      kind: 'HOME',
      provenance: 'MANUAL',
      dayDate: entry.dayDate,
      portion: 'FULL',
    },
  });

  return { userId: user.id, token: (await issueTokenPair(user.id)).accessToken };
}

function bearer(url: string, token: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...init.headers },
  });
}

describe('CLAIM 8: the export produces JSON and CSV of the days, their origin and stamps', () => {
  it('is still on the page', () => {
    expect(CONFIDENTIALITE_COPY.rights[0]).toContain('JSON');
    expect(CONFIDENTIALITE_COPY.rights[0]).toContain('CSV');
    expect(CONFIDENTIALITE_COPY.rights[0]).toContain('horodatages');

    // R242: AND IT SAYS WHEN. The server side exists; the way in does
    // not. Without this assertion the conditional could be dropped and
    // the page would go back to promising a channel that is not open.
    expect(CONFIDENTIALITE_COPY.rights[0]).toContain('lorsqu');
  });

  it('holds: both formats come back, and the stamps are in them', async () => {
    const { token } = await accountWithData('claim8@example.com');

    const json = (await (
      await exportRoute(bearer(`${TEST_ORIGIN}/api/v1/account/export`, token))
    ).json()) as { entries: { firstRecordedAt: string; provenance: string }[] };

    expect(json.entries.length).toBeGreaterThan(0);
    expect(json.entries[0]?.firstRecordedAt).toBeTruthy();
    expect(json.entries[0]?.provenance).toBe('MANUAL');

    const csv = await (
      await exportRoute(bearer(`${TEST_ORIGIN}/api/v1/account/export?format=csv`, token))
    ).text();

    expect(csv).toContain('firstRecordedAt');
  });
});

describe('CLAIM 9: deletion erases the account, the days, their history and the devices', () => {
  it('is still on the page, including that it cannot be undone', () => {
    expect(CONFIDENTIALITE_COPY.rights[1]).toContain('définitive');
    expect(CONFIDENTIALITE_COPY.rights[1]).toContain('historique');
    expect(CONFIDENTIALITE_COPY.rights[1]).toContain('lorsqu');
  });

  it('holds: every user-owned row is gone afterwards', async () => {
    const { userId, token } = await accountWithData('claim9@example.com');

    // PRESENCE FIRST: the rows must exist, or "they are gone" is satisfied by
    // an account that never had any.
    expect(await prisma.entry.count({ where: { userId } })).toBeGreaterThan(0);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBeGreaterThan(0);

    await deleteRoute(
      bearer(`${TEST_ORIGIN}/api/v1/account/delete`, token, {
        method: 'POST',
        body: JSON.stringify({ confirm: 'SUPPRIMER' }),
      }),
    );

    expect(await prisma.user.count({ where: { id: userId } })).toBe(0);
    expect(await prisma.entry.count({ where: { userId } })).toBe(0);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(0);
  });
});

describe('CLAIM 10: an alert-list subscription is separate and survives deletion', () => {
  it('is still on the page, and says the unsubscribe link stays valid', () => {
    expect(CONFIDENTIALITE_COPY.rights[2]).toContain('consentement distinct');
    expect(CONFIDENTIALITE_COPY.rights[2]).toContain('désinscription');
  });

  it('holds: the row and its unsubscribe token outlive the account', async () => {
    const { token } = await accountWithData('claim10@example.com');

    await prisma.alertSubscriber.create({
      data: {
        email: 'claim10@example.com',
        source: 'calculateur',
        confirmedAt: new Date(),
        unsubscribeTokenHash: 'claim10-hash',
      },
    });

    await deleteRoute(
      bearer(`${TEST_ORIGIN}/api/v1/account/delete`, token, {
        method: 'POST',
        body: JSON.stringify({ confirm: 'SUPPRIMER' }),
      }),
    );

    const row = await prisma.alertSubscriber.findUnique({
      where: { email: 'claim10@example.com' },
    });

    expect(row).not.toBeNull();
    expect(row?.unsubscribeTokenHash).toBe('claim10-hash');
  });
});

describe('CLAIM 11: a consent given can be withdrawn', () => {
  it('is still on the page', () => {
    expect(CONFIDENTIALITE_COPY.rightsIntro).toContain('retirer un consentement');
  });

  it('holds: revoking detection clears the stamp AND stops the sampling', async () => {
    // The half that matters. A page promising withdrawal, over a system that
    // kept sampling because the client was never told to stop, would be the
    // page describing intent again.
    const { userId, token } = await accountWithData('claim11@example.com');

    await mePatch(
      bearer(`${TEST_ORIGIN}/api/v1/me`, token, {
        method: 'PATCH',
        body: JSON.stringify({ detectionConsent: true, loggingMode: 'AUTO_DETECT' }),
      }),
    );

    const granted = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    expect(granted.detectionConsentAt).not.toBeNull();
    expect(granted.loggingMode).toBe('AUTO_DETECT');

    await mePatch(
      bearer(`${TEST_ORIGIN}/api/v1/me`, token, {
        method: 'PATCH',
        body: JSON.stringify({ detectionConsent: false }),
      }),
    );

    const revoked = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    expect(revoked.detectionConsentAt).toBeNull();
    expect(revoked.loggingMode).toBe('MANUAL');
  });
});
