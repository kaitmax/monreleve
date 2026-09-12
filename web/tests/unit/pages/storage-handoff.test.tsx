// @vitest-environment jsdom
//
// web/tests/unit/pages/storage-handoff.test.tsx
//
// FW13 increment 5: the one piece of client storage in the public product.
//
// WHAT IT IS FOR. SPEC 10: the calculator hands off to the Android app through
// install-referrer parameters - canton, taux, telework days - and the app
// pre-fills onboarding from them on first run. Nothing reads this key yet;
// FW11's handoff will. Writing it now means the scenario is already there when
// the reader taps through, instead of being reconstructed from a URL that a
// store listing may not carry.
//
// WHY A TEST WITH NO READER IS STILL WORTH WRITING. The SHAPE is the contract,
// and the other end of it is a different codebase that ships on a different
// schedule. A field renamed here between now and then is a defect nobody sees
// until an install lands with a blank onboarding form - so the shape is
// asserted on the day it is written, not on the day it is first read.
//
// AND IT MUST CARRY NOTHING PERSONAL. SPEC's privacy posture is not about
// cookies specifically; it is about what leaves the reader's control. A
// telework count is not personal data, an email address is, and the difference
// between them is one careless field. The assertion is a WHITELIST - only the
// nine public param names may appear - because a blacklist of things we
// thought of is not a guarantee.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { HANDOFF_KEY, HANDOFF_VERSION } from '@/lib/params/handoff';
import { PARAM_NAMES } from '@/lib/params/schema';

afterEach(cleanup);

const FORM = CALCULATEUR_COPY.form;
const TAX_YEAR = 2026;

/** The island's debounce, restated. */
const URL_DEBOUNCE_MS = 400;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const settle = async () => {
  await vi.advanceTimersByTimeAsync(URL_DEBOUNCE_MS * 2);
};

const enterGeneva = () => {
  fireEvent.change(screen.getByLabelText(FORM.canton.label), { target: { value: 'GE' } });
};

/** Every key the page has written, as a list, so it can be COUNTED. */
const storedKeys = (): string[] => {
  const keys: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (key !== null) keys.push(key);
  }

  return keys.sort();
};

describe('the handoff is written only once there is something to hand off', () => {
  it('writes nothing before a valid computation', async () => {
    // A reader who opened the page and left has handed off nothing, and a key
    // holding an empty scenario would be read by the app as a scenario.
    render(<CalculatorForm taxYear={TAX_YEAR} />);
    await settle();

    expect(storedKeys()).toEqual([]);
  });

  it('writes exactly one key, and it is the versioned one (R119)', async () => {
    // COUNTED, NOT CHECKED FOR PRESENCE. "The only client storage in the
    // public surface" is a statement about a COUNT: a second key added later
    // would satisfy every presence check ever written about the first.
    render(<CalculatorForm taxYear={TAX_YEAR} />);
    enterGeneva();
    await settle();

    expect(storedKeys()).toEqual([HANDOFF_KEY]);
  });

  it('writes nothing when the form parses but the ENGINE rejects', async () => {
    // THE STATE THE GATE EXISTS FOR, and the one a mutation found missing:
    // removing `if (hasResult)` passed every other test in this file, because
    // every other test is either a valid scenario or an unparsed one. A rate
    // of 150 % is neither - it is a NUMBER, so `input` is non-null and the
    // effect runs, and the engine refuses it (RATE_OUT_OF_RANGE), so there is
    // no answer. Handing that to the app would pre-fill onboarding with a
    // scenario that produces nothing.
    render(<CalculatorForm taxYear={TAX_YEAR} />);
    enterGeneva();
    fireEvent.change(screen.getByLabelText(FORM.rate.label), { target: { value: '150' } });
    await settle();

    expect(storedKeys()).toEqual([]);

    // AND THE URL STILL FOLLOWED IT, which is the asymmetry the effect
    // documents rather than an oversight: a reader sharing a link should send
    // exactly what they are looking at, including the value the engine is
    // complaining about - otherwise the person they send it to sees a
    // different form and no complaint.
    expect(window.location.search).toContain('taux=150');
  });

  it('carries its version in the key, so a shape change cannot be silent', () => {
    // The reader of this key is an app the user may not have updated. A
    // version in the KEY means an old app looking for v1 finds v1 or finds
    // nothing - never a v2 payload it will misread.
    expect(HANDOFF_KEY).toMatch(/\.v[0-9]+$/);
    expect(HANDOFF_KEY).toContain(String(HANDOFF_VERSION));
  });
});

describe('the shape is the contract, because the reader is another codebase', () => {
  const written = async (): Promise<Record<string, unknown>> => {
    render(<CalculatorForm taxYear={TAX_YEAR} />);
    enterGeneva();
    fireEvent.change(screen.getByLabelText(FORM.days.label), { target: { value: '84' } });
    await settle();

    const raw = window.localStorage.getItem(HANDOFF_KEY);

    expect(raw).not.toBeNull();

    return JSON.parse(String(raw)) as Record<string, unknown>;
  };

  it('has exactly two fields: the version and the params', async () => {
    const payload = await written();

    expect(Object.keys(payload).sort()).toEqual(['params', 'version']);
    expect(payload.version).toBe(HANDOFF_VERSION);
  });

  it('encodes the scenario with the SAME nine names as the URL', async () => {
    // ONE CODEC, NOT TWO. SPEC 9.4 froze nine names and SPEC 10 hands off
    // canton, taux and telework days - which are three of those nine. A
    // second spelling here would be a second public contract to keep, and the
    // app would be reading names that no URL ever carries.
    const payload = await written();
    const params = new URLSearchParams(String(payload.params));

    expect(params.get('canton')).toBe('GE');
    expect(params.get('tt')).toBe('84');

    for (const name of params.keys()) {
      expect(PARAM_NAMES as readonly string[]).toContain(name);
    }
  });

  it('carries nothing personal, by whitelist rather than by blacklist', async () => {
    // The nine names are a closed set of scenario numbers. Anything outside
    // it is by definition something nobody decided to publish - so the test
    // asks what IS there rather than listing what must not be.
    const payload = await written();
    const params = new URLSearchParams(String(payload.params));
    const names = [...params.keys()];

    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !(PARAM_NAMES as readonly string[]).includes(name))).toEqual(
      [],
    );

    // And the values are scenario values: canton codes, numbers, the two
    // method codes, the three granularity codes, an ISO day. No free text can
    // reach this, and this says so in the one way that keeps saying it when
    // somebody adds a tenth name.
    for (const value of params.values()) {
      expect(value).toMatch(/^[A-Za-z0-9.,-]{1,12}$/);
    }
  });
});

describe('storage that refuses does not take the page with it', () => {
  it('still renders the result when setItem throws', async () => {
    // Safari in private mode, a browser with site data disabled, a full
    // quota. The handoff is a convenience for an app the reader may never
    // install; the ANSWER is the product, and it must not depend on it.
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    render(<CalculatorForm taxYear={TAX_YEAR} />);
    enterGeneva();

    await expect(settle()).resolves.toBeUndefined();

    expect(setItem).toHaveBeenCalled();

    // The answer, still there. Asserted as "not the empty state, and it has a
    // rate in it" rather than against a fixed sentence: the first version
    // looked for the section's h2, which lives OUTSIDE the live region and
    // would have gone red on a page that was working perfectly.
    const region = document.querySelector('#resultat')?.textContent ?? '';

    expect(region).not.toBe(CALCULATEUR_COPY.result.empty);
    expect(region).toContain('%');

    setItem.mockRestore();
  });
});

describe('each test starts with an empty store, and that is measured', () => {
  it('sees nothing left by the tests above, which all wrote the key', () => {
    // PLACED HERE ON PURPOSE. Every describe above this one runs a valid
    // computation and leaves the handoff key behind, because jsdom gives a
    // test FILE one Storage the same way it gives it one window. Without the
    // clear in tests/setup/browser-state.ts this assertion fails, which is
    // what makes "the page writes exactly ONE key" a statement about the page
    // rather than about test order.
    //
    // The first test in this file - "writes nothing before a valid
    // computation" - could not prove it: it runs first, so it passes on an
    // empty store whether anything clears it or not.
    expect(storedKeys()).toEqual([]);
  });
});

describe('localStorage is not a cookie, and the trace test does not cover it', () => {
  it('sets no cookie while writing the handoff', async () => {
    // e2e/home.spec.ts asserts context.cookies() is empty (SPEC D12). That
    // test visits "/" and reads COOKIES - it would pass unchanged if this
    // page wrote a megabyte of localStorage, and it would pass unchanged if
    // this page were deleted. The distinction is stated here so nobody later
    // reads that green as covering this.
    render(<CalculatorForm taxYear={TAX_YEAR} />);
    enterGeneva();
    await settle();

    expect(document.cookie).toBe('');
    expect(window.localStorage.getItem(HANDOFF_KEY)).not.toBeNull();
  });
});
