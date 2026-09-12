// @vitest-environment jsdom
//
// web/tests/unit/pages/share-controls.test.tsx
//
// FW13 increment 4: the URL follows the form, and the share row.
//
// THREE PROPERTIES, and each one is a thing that goes wrong quietly.
//
// replaceState, NEVER pushState. Every keystroke in this form changes the
// scenario, so pushing would fill the back stack with one entry per
// character: a reader who typed "84" and pressed Back twice would still be on
// the calculator, and the third press would take them somewhere they never
// asked to leave. The history LENGTH is what says which was used, because
// both write the same address bar.
//
// THE COPY CONFIRMATION IS ANNOUNCED, not flashed. SPEC 9.4's share is the
// growth mechanic and a toast that disappears is invisible to a screen reader
// and to anyone who looked away - so the confirmation is text in a polite live
// region that STAYS. The prompt is explicit: "not a toast that disappears".
//
// "Partager" IS ABSENT WITHOUT THE API, not broken. navigator.share exists on
// phones and in Safari and nowhere else, and a button that does nothing when
// pressed is worse than a button that is not there - the reader concludes the
// site is broken rather than that their browser lacks a feature.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { SHARE_COPY } from '@/lib/fr/params';

afterEach(cleanup);

const FORM = CALCULATEUR_COPY.form;
const TAX_YEAR = 2026;

/**
 * The island’s debounce, restated.
 *
 * A test that advanced by a hardcoded 600 ms could not say what it was
 * waiting for, and would keep passing if the delay grew to five seconds.
 */
const URL_DEBOUNCE_MS = 400;

const setUp = () => render(<CalculatorForm taxYear={TAX_YEAR} />);

const field = (label: string): HTMLInputElement =>
  screen.getByLabelText(label) as HTMLInputElement;

const type = (element: HTMLInputElement, value: string) => {
  fireEvent.change(element, { target: { value } });
};

const enterGeneva = () => {
  fireEvent.change(screen.getByLabelText(FORM.canton.label), { target: { value: 'GE' } });
  type(field(FORM.days.label), '84');
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.history.replaceState(null, '', '/calculateur-teletravail-frontalier');
});

afterEach(() => {
  vi.useRealTimers();
});

/** Let the debounce fire, with room to spare. */
const settle = async () => {
  await vi.advanceTimersByTimeAsync(URL_DEBOUNCE_MS * 2);
};

describe('the URL follows the form, without filling the back stack', () => {
  it('writes the scenario into the address bar', async () => {
    setUp();
    enterGeneva();
    await settle();

    expect(window.location.search).toContain('canton=GE');
    expect(window.location.search).toContain('tt=84');
  });

  it('uses replaceState: the history length never grows', async () => {
    // THE ASSERTION THAT TELLS THE TWO APART. Both write the address bar; only
    // pushState adds an entry. Typing four values here would be four entries
    // of back-button noise, and the reader would never get off the page.
    const before = window.history.length;

    setUp();
    enterGeneva();
    await settle();

    type(field(FORM.days.label), '96');
    await settle();

    type(field(FORM.days.label), '110');
    await settle();

    expect(window.history.length).toBe(before);
  });

  it('waits the debounce out, rather than writing on every keystroke', async () => {
    // THE ONE DEBOUNCE IN THIS PRODUCT, and the asymmetry is deliberate: the
    // ENGINE is free - it recomputes on every input event with no debounce,
    // because SPEC 9.3 says so and it costs microseconds - while a
    // replaceState per character is main-thread work for a URL nobody reads
    // mid-word.
    //
    // ADVANCED PART-WAY, WHICH THE FIRST VERSION DID NOT DO. It asserted the
    // address bar was empty before advancing at all, and a mutation setting
    // the delay to ZERO passed it - a fake timer has not fired at 0 ms
    // either. Half the delay tells 400 from 0; the full delay tells it from
    // never.
    setUp();
    enterGeneva();

    await vi.advanceTimersByTimeAsync(URL_DEBOUNCE_MS / 2);

    expect(window.location.search, 'written before the debounce elapsed').toBe('');

    await vi.advanceTimersByTimeAsync(URL_DEBOUNCE_MS);

    expect(window.location.search).toContain('canton=GE');
  });

  it('leaves the bare path alone until there is something to share', async () => {
    // A URL of defaults is not a scenario, and rewriting the address bar the
    // moment somebody lands on the page - before they have typed - would put
    // a query string in front of a reader who did not ask for one.
    setUp();
    await settle();

    expect(window.location.search).toBe('');
  });
});

describe('the share row sits where it belongs on the page', () => {
  it('comes after the link notice and before the answer', async () => {
    // WHAT NO OTHER TEST IN THIS INCREMENT ASSERTS: what is next to what.
    //
    // The share row shipped ABOVE the link notice and every test passed, in
    // both orders, because each one reaches for its own element by selector
    // and none of them looks at the sequence. It was found by cropping a
    // baseline and reading it - the page said: form, two share buttons, then
    // "your link was incomplete - you can correct the fields above; the link
    // you share will be up to date". Advice about sharing, arriving after the
    // buttons it is advice about.
    //
    // THE ORDER IS THE CLAIM. The notice explains why the form in front of
    // the reader looks the way it does, so it belongs against the form. The
    // share row is what you do once the form is right. The answer is last
    // because it is the longest thing on the page.
    window.history.replaceState(
      null,
      '',
      '/calculateur-teletravail-frontalier?canton=GE&tt=84&taux=abc&utm_source=facebook',
    );

    setUp();
    await settle();

    const landmarks = [
      ...document.querySelectorAll('[data-notice="params"], [data-share], #resultat'),
    ];

    const name = (element: Element): string => {
      if (element.hasAttribute('data-share')) return 'share';

      return element.getAttribute('data-notice') ?? element.id;
    };

    expect(landmarks.map(name)).toEqual(['params', 'share', 'resultat']);
  });

  it('is still present, and still before the answer, without a notice', () => {
    // NON-VACUITY. The assertion above needs a notice to exist to say
    // anything about it, and a notice only exists for a damaged link - so
    // this states the part that holds for every reader, including the
    // majority who typed their way here and never see a notice at all.
    setUp();

    const landmarks = [...document.querySelectorAll('[data-share], #resultat')];

    expect(landmarks).toHaveLength(2);
    expect(landmarks[0]?.hasAttribute('data-share')).toBe(true);
    expect(landmarks[1]?.id).toBe('resultat');
    expect(document.querySelector('[data-notice="params"]')).toBeNull();
  });
});

describe('the copy control announces, and does not vanish', () => {
  it('copies the current URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    setUp();
    enterGeneva();
    await settle();

    fireEvent.click(screen.getByRole('button', { name: SHARE_COPY.copy }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    expect(String(writeText.mock.calls[0]?.[0])).toContain('canton=GE');

    vi.unstubAllGlobals();
  });

  it('confirms in a polite live region that STAYS', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    setUp();
    enterGeneva();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: SHARE_COPY.copy }));

    const region = await waitFor(() => {
      const found = document.querySelector('[data-share-status]');

      expect(found?.textContent).toContain(SHARE_COPY.copied);

      return found;
    });

    expect(region?.getAttribute('aria-live')).toBe('polite');

    // AND IT IS STILL THERE. A toast would have gone by now; this is the
    // property the prompt names and a timer would break.
    //
    // INSIDE act(), WHICH IS WHAT MAKES THE ASSERTION MEAN ANYTHING. A
    // mutation adding setShareStatus("") on a 3 s timer passed this test:
    // the timer fired, but the state update it caused was never flushed,
    // so the query below re-read DOM from before the clear and found the
    // message it was looking for. Advancing time is not the same as
    // letting React see that time passed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(document.querySelector('[data-share-status]')?.textContent).toContain(
      SHARE_COPY.copied,
    );

    vi.unstubAllGlobals();
  });

  it('says so when the clipboard refuses', async () => {
    // A permissions policy, a non-secure context, or a browser that simply
    // says no. The reader still has the URL in the address bar, and the
    // message says to use it rather than leaving them to wonder.
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));

    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    setUp();
    enterGeneva();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: SHARE_COPY.copy }));

    await waitFor(() => {
      expect(document.querySelector('[data-share-status]')?.textContent).toContain(
        SHARE_COPY.copyFailed,
      );
    });

    vi.unstubAllGlobals();
  });
});

describe('the share control is absent where the API is', () => {
  it('does not render without navigator.share', () => {
    // jsdom has no navigator.share, which is the same condition as a desktop
    // browser - the majority case for a link pasted into a Facebook thread
    // and opened later on a laptop.
    setUp();

    expect(screen.queryByRole('button', { name: SHARE_COPY.share })).toBeNull();
  });

  it('is absent from the SERVER render, so hydration cannot flash it', () => {
    // THE PROPERTY A MUTATION FOUND MISSING. Starting canShare at `true`
    // passed every assertion here: the mount effect corrects it to false
    // before Testing Library hands back control, so the final DOM is right.
    // What that misses is the render BEFORE the effect - which on a desktop
    // is a "Partager" button that appears and then vanishes, and in
    // hydration terms is server markup disagreeing with the client.
    //
    // renderToStaticMarkup is the server’s view, where there is no
    // navigator at all.
    //
    // COUNTED AS CONTROLS, NOT AS A SUBSTRING (R119). The first version
    // asserted the markup did not CONTAIN "Partager" and went red on the
    // row’s own heading - "Partager ce calcul" - which is a defect in the
    // assertion and not in the page. The property is about a BUTTON, so
    // buttons are what get counted.
    const markup = renderToStaticMarkup(<CalculatorForm taxYear={TAX_YEAR} />);
    const host = document.createElement('div');

    host.innerHTML = markup;

    const labels = [...host.querySelectorAll('button')].map(
      (button) => button.textContent,
    );

    expect(labels.filter((label) => label === SHARE_COPY.share)).toHaveLength(0);

    // Non-vacuity: the row itself IS server-rendered, exactly once; it is
    // only the native button that waits for the API.
    expect(labels.filter((label) => label === SHARE_COPY.copy)).toHaveLength(1);
  });

  it('renders and calls navigator.share when it exists', async () => {
    const share = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('navigator', { ...navigator, share });

    setUp();
    enterGeneva();
    await settle();

    const button = await screen.findByRole('button', { name: SHARE_COPY.share });

    fireEvent.click(button);

    await waitFor(() => {
      expect(share).toHaveBeenCalledTimes(1);
    });

    const payload = share.mock.calls[0]?.[0] as { url?: string; title?: string };

    expect(String(payload.url)).toContain('canton=GE');
    expect(String(payload.title)).toBe(SHARE_COPY.shareTitle);

    vi.unstubAllGlobals();
  });

  it('stays quiet when the reader cancels the share sheet', async () => {
    // navigator.share rejects with AbortError when the sheet is dismissed.
    // That is not a failure and must not be announced as one - the reader
    // chose it.
    const share = vi.fn().mockRejectedValue(
      Object.assign(new Error('cancelled'), { name: 'AbortError' }),
    );

    vi.stubGlobal('navigator', { ...navigator, share });

    setUp();
    enterGeneva();
    await settle();

    fireEvent.click(await screen.findByRole('button', { name: SHARE_COPY.share }));

    await waitFor(() => {
      expect(share).toHaveBeenCalled();
    });

    expect(document.querySelector('[data-share-status]')?.textContent ?? '').toBe('');

    vi.unstubAllGlobals();
  });
});
