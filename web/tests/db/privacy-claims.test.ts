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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/alertes/route';
import { prisma } from '@/lib/db/client';
import { CONFIDENTIALITE_COPY } from '@/lib/fr/confidentialite';
import { ALERTES_COPY } from '@/lib/fr/alertes';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { confirmByToken, unsubscribeByToken } from '@/lib/alerts/confirm';
import { recordSubscription } from '@/lib/alerts/record';
import { purgeUnconfirmed, PURGE_AFTER_DAYS } from '@/lib/alerts/purge';
import { resetRateLimit } from '@/lib/alerts/rate-limit';

/** Written once: a literal escape in a heredoc has bitten this session three times. */
const NEWLINE = String.fromCharCode(10);

const ORIGIN = 'https://frontalier.example';
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
    expect(CONFIDENTIALITE_COPY.web[0]).toContain('aucun cookie');
    expect(CONFIDENTIALITE_COPY.web[0]).toContain('aucun compte');
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
  it('is still on the page', () => {
    expect(CONFIDENTIALITE_COPY.web[1]).toContain('uniquement si vous la donnez');
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
    expect(CONFIDENTIALITE_COPY.web[1]).toContain('lien de ');
    expect(CONFIDENTIALITE_COPY.web[1]).toContain('confirmation');
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
    expect(CONFIDENTIALITE_COPY.web[1]).toContain('la date de votre accord');
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
    expect(CONFIDENTIALITE_COPY.web[1]).toContain('désinscription en un clic');
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

describe('the map covers the page rather than a chosen part of it', () => {
  it('names every alert-list sentence the page carries', () => {
    // R63, applied to a privacy map. The seven claims above are worth
    // nothing if an EIGHTH sentence about the alert list exists on the page
    // and nobody noticed. This finds every sentence that mentions the list
    // and requires it to be one this file has taken a position on.
    const MAPPED = [
      CONFIDENTIALITE_COPY.web[0],
      CONFIDENTIALITE_COPY.web[1],
      CONFIDENTIALITE_COPY.basis[1],
      CONFIDENTIALITE_COPY.retention[0],
      CONFIDENTIALITE_COPY.retention[3],
    ];

    /**
     * Sentences this task does not own, named rather than filtered away.
     *
     * The analytics claim - self-hosted, cookieless, no third party - is
     * FW15's to make true, and FW14 neither implements nor contradicts it:
     * nothing in this task measures anything. It is listed HERE rather than
     * excluded by a narrower filter, because a filter that quietly stopped
     * matching it would be indistinguishable from nobody having noticed it.
     *
     * It is still a published claim with no code behind it, which is the
     * same shape AC3 exists to catch - and it goes in the report as such.
     */
    const NOT_THIS_TASK = [CONFIDENTIALITE_COPY.web[2]];

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
