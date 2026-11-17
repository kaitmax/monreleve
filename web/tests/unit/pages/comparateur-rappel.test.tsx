// @vitest-environment jsdom
// web/tests/unit/pages/comparateur-rappel.test.tsx
//
// FW-DELAI-RAPPEL, R918: the reminder form in the "Votre délai" helper, and
// the six outcomes the links land on. Rendered from the real page.
//
// THE CLOCK IS PLACED (R171): the form is offered only while the reminder's
// due day has not passed, and "today" is the reader's own day - so every test
// here sets it, and the event is a day chosen against it.
//
// THE REQUEST IS READ, NOT ASSUMED (R750): fetch is replaced by a recorder,
// and its body must hold the address and the COMPUTED end date and nothing
// else from the page.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import ComparateurPage from '@/app/(public)/calculateur-lamal-cmu/page';
import { DEADLINE_ID } from '@/app/(public)/calculateur-lamal-cmu/DeadlineHelper';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { RAPPEL_COPY } from '@/lib/fr/rappel';
import { RAPPEL_FORM_COPY } from '@/lib/fr/rappel-form';
import { OPTION_PERIOD_MONTHS, optionPeriodEnd } from '@/lib/lamal/deadline';
import { LANDING_STATES, landingFragment } from '@/lib/rappel/landing';
import { REMINDER_ENDPOINT, REMINDER_STATUS } from '@/lib/rappel/status';
import { DAYS_BEFORE, MAX_MONTHS_AHEAD, latestDeadline, reminderDay, shiftDays, shiftMonths } from '@/lib/rappel/window';

expect.extend(matchers);

/** The reader's today, placed. */
const TODAY = '2026-11-12';
/** An event that day: its end is three months on, far beyond fourteen days. */
const EVENT = TODAY;
const END = optionPeriodEnd(EVENT) ?? '';

interface Recorded {
  url: string;
  method: string;
  body: URLSearchParams;
}

const requests: Recorded[] = [];
let reply: () => Promise<Response> = async () =>
  new Response(JSON.stringify({ status: REMINDER_STATUS.ok, message: RAPPEL_COPY.answers.ok }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00`));
  requests.length = 0;
  reply = async () => new Response(JSON.stringify({ status: REMINDER_STATUS.ok, message: RAPPEL_COPY.answers.ok }));
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    requests.push({ url, method: init.method ?? 'GET', body: new URLSearchParams(String(init.body)) });

    return reply();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cleanup();
});

const change = (element: Element, value: string): void => {
  fireEvent.change(element, { target: { value } });
};

function dated(event: string): void {
  change(screen.getByLabelText(LAMAL_COPY.deadline.date), event);
}

async function send(email: string): Promise<void> {
  change(screen.getByLabelText(RAPPEL_FORM_COPY.label), email);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: RAPPEL_FORM_COPY.submit }));
  });
}

describe('R918: the form appears once a date is computed', () => {
  it('is absent before a date, present after', () => {
    render(<ComparateurPage />);

    expect(document.querySelector('[data-reminder-form]')).toBeNull();

    dated(EVENT);

    expect(document.querySelector('[data-reminder-form]')).not.toBeNull();
    expect(screen.getByLabelText(RAPPEL_FORM_COPY.label)).toBeTruthy();
    expect(document.querySelector('[data-reminder-form]')?.textContent).toContain(RAPPEL_FORM_COPY.hint);
  });

  it(`is absent for a date whose due day has passed - fewer than ${DAYS_BEFORE} days left (R916)`, () => {
    render(<ComparateurPage />);
    // An event whose end is DAYS_BEFORE - 1 days after today.
    const late = shiftDays(TODAY, -(92 - (DAYS_BEFORE - 1))) ?? '';
    const lateEnd = optionPeriodEnd(late) ?? '';

    expect(reminderDay(lateEnd) !== undefined && (reminderDay(lateEnd) ?? '') < TODAY).toBe(true);

    dated(late);

    expect(document.querySelector('[data-deadline-end]')?.getAttribute('data-deadline-end')).toBe(lateEnd);
    expect(document.querySelector('[data-reminder-form]')).toBeNull();
  });

  it('is still offered ON the due day', () => {
    vi.setSystemTime(new Date(`${reminderDay(END) ?? ''}T10:00:00`));
    render(<ComparateurPage />);
    dated(EVENT);

    expect(document.querySelector('[data-reminder-form]')).not.toBeNull();
  });

  it('gives its controls no name, so even a native submission carries nothing (R750)', () => {
    render(<ComparateurPage />);
    dated(EVENT);

    for (const control of document.querySelectorAll('[data-reminder-form] input, [data-reminder-form] button')) {
      expect(control.getAttribute('name'), control.outerHTML.slice(0, 80)).toBeNull();
    }
    expect(document.querySelector('[data-reminder-form]')?.getAttribute('action')).toBeNull();
  });
});

describe('R1000 / R1004 (R225): where no form is offered for a computed date, the helper says why', () => {
  /** The note in the form's place, read off the rendered page. */
  const note = (): Element | null => document.querySelector('[data-reminder-refused]');

  it(`says the reminder's day has passed, for a date fewer than ${DAYS_BEFORE} days away`, () => {
    render(<ComparateurPage />);
    // An event whose end is DAYS_BEFORE - 1 days after today, as above.
    dated(shiftDays(TODAY, -(92 - (DAYS_BEFORE - 1))) ?? '');

    expect(document.querySelector('[data-reminder-form]')).toBeNull();
    expect(note()?.getAttribute('data-reminder-refused')).toBe('too-close');
    expect(note()?.textContent).toBe(RAPPEL_FORM_COPY.tooClose);
    expect(note()?.getAttribute('role')).toBe('status');
  });

  it(`says the date is too far, for one more than ${MAX_MONTHS_AHEAD} months ahead - by its rule, never its figure (R153)`, () => {
    render(<ComparateurPage />);
    // An event whose end is the day after the latest date allowed today.
    const beyond = shiftDays(latestDeadline(TODAY) ?? '', 1) ?? '';
    const event = shiftMonths(beyond, -OPTION_PERIOD_MONTHS) ?? '';

    expect(optionPeriodEnd(event)).toBe(beyond);

    dated(event);

    expect(document.querySelector('[data-reminder-form]')).toBeNull();
    expect(note()?.getAttribute('data-reminder-refused')).toBe('too-far');
    expect(note()?.textContent).toBe(RAPPEL_FORM_COPY.tooFar);
    expect(RAPPEL_FORM_COPY.tooFar).not.toMatch(/\d/u);
  });

  it('offers the form on the latest date itself, and says nothing then', () => {
    render(<ComparateurPage />);
    const latest = latestDeadline(TODAY) ?? '';
    const event = shiftMonths(latest, -OPTION_PERIOD_MONTHS) ?? '';

    expect(optionPeriodEnd(event)).toBe(latest);

    dated(event);

    expect(document.querySelector('[data-reminder-form]')).not.toBeNull();
    expect(note()).toBeNull();
  });

  it('says nothing before a date is computed', () => {
    render(<ComparateurPage />);

    expect(note()).toBeNull();
  });
});

describe('R918 / R750: the request carries the address and the COMPUTED date, nothing else', () => {
  it('posts exactly two fields to the endpoint', async () => {
    render(<ComparateurPage />);
    change(screen.getByLabelText(LAMAL_COPY.form.income.label), '73519');
    dated(EVENT);
    await send('rappel@monreleve.test');

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(REMINDER_ENDPOINT);
    expect(requests[0]?.method).toBe('POST');
    expect([...(requests[0]?.body.keys() ?? [])].sort()).toEqual(['date', 'email']);
    expect(requests[0]?.body.get('date')).toBe(END);
    expect(requests[0]?.body.get('email')).toBe('rappel@monreleve.test');
    expect(String(requests[0]?.body)).not.toContain('73519');
    expect(String(requests[0]?.body)).not.toContain(EVENT);
  });
});

describe('R225: the confirmation state is on the rendered page', () => {
  it('replaces the form with the server\'s sentence, as a status', async () => {
    render(<ComparateurPage />);
    dated(EVENT);
    await send('rappel@monreleve.test');

    const sent = document.querySelector('[data-reminder-sent]');

    expect(sent?.textContent).toBe(RAPPEL_COPY.answers.ok);
    expect(sent?.getAttribute('role')).toBe('status');
    expect(document.querySelector('[data-reminder-form]')).toBeNull();
  });

  it('brings the form back when the date changes, since the answer was about the other date', async () => {
    render(<ComparateurPage />);
    dated(EVENT);
    await send('rappel@monreleve.test');
    dated(shiftDays(EVENT, 1) ?? '');

    expect(document.querySelector('[data-reminder-sent]')).toBeNull();
    expect(document.querySelector('[data-reminder-form]')).not.toBeNull();
  });
});

describe('the refusals', () => {
  it('names an address error on the field', async () => {
    reply = async () =>
      new Response(JSON.stringify({ status: REMINDER_STATUS.invalid, message: RAPPEL_COPY.answers.invalid }));
    render(<ComparateurPage />);
    dated(EVENT);
    await send('pas-une-adresse');

    const field = document.getElementById(DEADLINE_ID.email);

    expect(field?.getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('[data-reminder-form] [role="alert"]')?.textContent).toContain(
      RAPPEL_COPY.answers.invalid,
    );
  });

  it('shows a refused date as the form\'s own alert', async () => {
    reply = async () => new Response(JSON.stringify({ status: REMINDER_STATUS.date, message: RAPPEL_COPY.answers.date }));
    render(<ComparateurPage />);
    dated(EVENT);
    await send('rappel@monreleve.test');

    expect(document.querySelector('[data-reminder-form] [role="alert"]')?.textContent).toBe(RAPPEL_COPY.answers.date);
  });

  it('says so when no answer came back at all', async () => {
    reply = async () => {
      throw new TypeError('network');
    };
    render(<ComparateurPage />);
    dated(EVENT);
    await send('rappel@monreleve.test');

    expect(document.querySelector('[data-reminder-form] [role="alert"]')?.textContent).toBe(RAPPEL_FORM_COPY.offline);
  });
});

describe('the six outcomes the links land on', () => {
  it('renders every one, each under its own fragment, with the server copy', () => {
    render(<ComparateurPage />);

    for (const [key, state] of Object.entries(LANDING_STATES)) {
      const element = document.getElementById(landingFragment(state));
      const copy = RAPPEL_COPY.outcomes[key as keyof typeof RAPPEL_COPY.outcomes];

      expect(element?.getAttribute('data-rappel-outcome')).toBe(state);
      expect(element?.textContent).toContain(copy.heading);
      expect(element?.textContent).toContain(copy.body);
      expect(element?.getAttribute('role')).toBe('status');
    }
  });
});

describe('R1000: the "trop-tard" outcome says nothing was kept, on the rendered page', () => {
  it('ends on the sentence every deleting outcome ends on', () => {
    render(<ComparateurPage />);

    const element = document.getElementById(landingFragment(LANDING_STATES.tooLate));

    expect(RAPPEL_COPY.nothingKept).toBeTruthy();
    expect(element?.textContent).toContain(RAPPEL_COPY.nothingKept);
  });
});

describe('jest-axe (SPEC 16)', () => {
  it('the helper with the form offered, and after a refusal', async () => {
    reply = async () =>
      new Response(JSON.stringify({ status: REMINDER_STATUS.invalid, message: RAPPEL_COPY.answers.invalid }));
    const { container } = render(<ComparateurPage />);

    dated(EVENT);
    expect(await axe(container)).toHaveNoViolations();

    await send('pas-une-adresse');
    expect(await axe(container)).toHaveNoViolations();
  });
});
