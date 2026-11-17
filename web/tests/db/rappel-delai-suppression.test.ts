// web/tests/db/rappel-delai-suppression.test.ts
//
// FW-DELAI-RAPPEL, R1002 AND R1003: THE DELETE LINK OPENS A PAGE WITH ONE
// BUTTON, ONLY THE BUTTON DELETES, AND EVERY DELETE LINK WORKS FOR AS LONG AS
// ITS ROW EXISTS.
//
// THROUGH THE REAL ENTRY POINTS (R204). The link is taken out of a message in
// the outbox. "Opening" it goes to whatever Next would serve at that path - the
// page, rendered as the server renders it, or a route handler's GET - and
// "pressing the button" reads the form's action and hidden token OUT OF THE
// RENDERED HTML, never from a constant here, and sends them to the handler
// Next serves at that action. A test that called deleteReminderByToken would
// prove the function and not the page a person presses.
//
// The two actions are tests/db/support/rappel-links.ts's open and press,
// shared with the request, job and round-trip files.

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { TEST_ORIGIN } from '../../lib/content/identity';
import { DELETE_ROUTE_FILE, formIn, linkIn, open, press, pressLink } from './support/rappel-links';
import { POST as REQUEST } from '@/app/api/rappel-delai/route';
import { GET as CONFIRM } from '@/app/api/rappel-delai/confirm/route';
import * as DELETE_ROUTE from '@/app/api/rappel-delai/suppression/route';
import { prisma } from '@/lib/db/client';
import { siteOrigin } from '@/lib/content/site';
import { clearOutbox, readOutbox, type Message } from '@/lib/alerts/mailer';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { parisDayOf } from '@/lib/entries/day';
import { runDeadlineReminders } from '@/lib/rappel/job';
import { LANDING_STATES, landingFor } from '@/lib/rappel/landing';
import { CONFIRM_PATH, DELETE_PATH } from '@/lib/rappel/mail';
import { reminderDay, shiftDays } from '@/lib/rappel/window';

const EMAIL = 'suppression@monreleve.test';

/** A date well ahead of the real clock (R171: derived, never typed). */
const DEADLINE = shiftDays(parisDayOf(new Date()), 120) ?? '';

/** Noon in Paris on an ISO day. */
const noonOn = (day: string): Date => new Date(`${day}T11:00:00Z`);

let ip = 0;

/** The POST the comparator's island makes. */
async function request(email = EMAIL, date = DEADLINE): Promise<void> {
  ip += 1;
  await REQUEST(
    new NextRequest(`${TEST_ORIGIN}/api/rappel-delai`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': `10.9.${ip}.1` },
      body: new URLSearchParams({ email, date }).toString(),
    }),
  );
}

/** The last message the mailer collected. */
function lastText(): string {
  const message = readOutbox().at(-1);

  expect(message, 'no message was collected: nothing below would test anything').toBeDefined();

  return message?.text ?? '';
}

/** The relative Location of a redirect. */
const located = (response: Response): string | null => response.headers.get('location');

/** Request, then confirm through the confirmation's own link; return the confirmation's delete link. */
async function confirmedRequest(email = EMAIL): Promise<string> {
  await request(email);

  const text = lastText();
  const remove = linkIn(text, DELETE_PATH);

  await CONFIRM(new NextRequest(linkIn(text, CONFIRM_PATH)));

  return remove;
}

beforeEach(async () => {
  await prisma.deadlineReminder.deleteMany();
  clearOutbox();
  resetRateLimit();
});

afterEach(() => {
  clearOutbox();
});

afterAll(async () => {
  await prisma.deadlineReminder.deleteMany();
  await prisma.$disconnect();
});

describe('R1002: the delete link opens a page with ONE button, and opening it deletes nothing', () => {
  it('opening the link - as a mail client fetching it would, twice - leaves the row', async () => {
    const link = await confirmedRequest();

    await open(link);
    await open(link);

    expect(await prisma.deadlineReminder.count()).toBe(1);
  });

  it('the endpoint the button posts to answers no GET, so fetching it directly deletes nothing either', async () => {
    expect(existsSync(DELETE_ROUTE_FILE)).toBe(true);
    expect(Object.keys(DELETE_ROUTE)).toEqual(['POST']);
  });

  it('the page is a plain form: one button, method post, the token in a hidden field', async () => {
    const link = await confirmedRequest();
    const html = await open(link);
    const { buttons, fields, method } = formIn(html);

    expect(buttons).toBe(1);
    expect(method).toBe('post');
    expect(fields.get('token')).toBe(new URL(link).searchParams.get('token'));
    // No JavaScript of its own: the page is a server component, and nothing
    // in what it renders is a script (the framework's own are the layout's).
    expect(html).not.toMatch(/<script\b/u);
  });

  it('pressing the button deletes the address and the date, and lands on the comparator', async () => {
    const response = await pressLink(await confirmedRequest());

    expect(response.status).toBe(303);
    expect(located(response)).toBe(landingFor(LANDING_STATES.deleted));
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it('renders the same page for every token, real or never issued (no oracle, R915)', async () => {
    const real = new URL(await confirmedRequest());
    const invented = new URL(real);

    invented.searchParams.set('token', 'f'.repeat(64));

    const strip = (html: string): string => html.replace(/value="[0-9a-f]{64}"/u, 'value=""');

    expect(strip(await open(String(invented)))).toBe(strip(await open(String(real))));
    expect(strip(await open(`${siteOrigin()}${DELETE_PATH}`))).toBe(strip(await open(String(real))));
  });
});

describe('R1003: a delete link works for as long as its row exists, and "no row" reads as "deleted now"', () => {
  it('a second press, and a token never issued, land exactly where a deletion does', async () => {
    const page = await open(await confirmedRequest());
    const first = await press(page);
    const second = await press(page);
    const invented = await press(await open(`${siteOrigin()}${DELETE_PATH}?token=${'0'.repeat(64)}`));

    expect(located(first)).toBe(landingFor(LANDING_STATES.deleted));
    expect(located(second)).toBe(located(first));
    expect(located(invented)).toBe(located(first));
  });

  it("the first confirmation's link still deletes after a renewal sent a newer one", async () => {
    await request();

    const older = linkIn(lastText(), DELETE_PATH);

    // The same address again while unconfirmed: a new date, a new message.
    await request(EMAIL, shiftDays(DEADLINE, 7) ?? '');

    expect(readOutbox()).toHaveLength(2);
    expect(linkIn(lastText(), DELETE_PATH)).not.toBe(older);

    await pressLink(older);

    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it("after failed sends, the confirmation's link AND every reminder's link still delete the row", async () => {
    const confirmation = await confirmedRequest();

    // Three passes on the due day whose sends go out but are REPORTED failed:
    // the person may hold any of these messages, and the row survives each.
    const captured: Message[] = [];
    const deliveredButFailed = async (message: Message): Promise<boolean> => {
      captured.push(message);

      return false;
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await runDeadlineReminders(noonOn(reminderDay(DEADLINE) ?? ''), deliveredButFailed);
    }

    expect(captured).toHaveLength(3);

    const links = [confirmation, ...captured.map((message) => linkIn(message.text, DELETE_PATH))];

    expect(new Set(links).size).toBe(4);

    // Each link in turn: pressed, the row is gone; then the row is put back
    // exactly as it was, so the next link is tried against the same state.
    const saved = await prisma.deadlineReminder.findFirstOrThrow();

    for (const link of links) {
      await pressLink(link);

      expect(await prisma.deadlineReminder.count(), `${link.slice(-12)} did not delete the row`).toBe(0);

      await prisma.deadlineReminder.create({ data: saved });
    }
  });
});
