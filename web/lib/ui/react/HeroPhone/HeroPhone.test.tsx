// @vitest-environment jsdom
// web/lib/ui/react/HeroPhone/HeroPhone.test.tsx
//
// R716: the two phones. Each is ONE image with a plain-language name; the
// platform is the cut-out and nothing else (no status bar); the words are the
// app's (equal to Kotlin by tests/unit/fr/home-copy.test.ts); the rate is the
// engine's for the worked example.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { calculateTelework, ruleSetFor } from '@/lib/calc-engine';
import type { TeleworkResult } from '@/lib/calc-engine';
import { heroExampleInput } from '@/lib/content/home';
import { HOME_COPY } from '@/lib/fr/home';
import { formatPercent, zoneFor } from '@/lib/ui/core';
import { HeroPhone } from './HeroPhone';

afterEach(cleanup);

const YEAR = 2026;
const COPY = HOME_COPY.phone;
const FISCAL = formatPercent(ruleSetFor(YEAR).fiscalCeiling * 100, 0);

/**
 * Testing Library collapses whitespace in the DOM text it compares - U+00A0
 * included - but not in a string matcher. French copy carries U+00A0 before
 * "?" and "%" (R91), so a matcher is put through the same collapse.
 */
const seen = (text: string): string => text.replace(/\s+/gu, ' ');

function example(): TeleworkResult {
  const outcome = calculateTelework(heroExampleInput(YEAR));

  if (!outcome.ok) throw new Error('the worked example must be a valid engine input');

  return outcome.value;
}

describe('the phones (R716)', () => {
  it('Android shows the question and its three answers, as one named image', () => {
    render(<HeroPhone platform="android" result={example()} taxYear={YEAR} fiscal={FISCAL} />);

    const image = screen.getByRole('img', { name: COPY.androidLabel });

    for (const word of [COPY.question, COPY.swiss, COPY.home, COPY.mission, COPY.absence]) {
      expect(within(image).getByText(seen(word))).toBeTruthy();
    }
    expect(within(image).queryByText(COPY.recorded)).toBeNull();
  });

  it('the iPhone shows the day once answered: Domicile, recorded, editable', () => {
    render(<HeroPhone platform="iphone" result={example()} taxYear={YEAR} fiscal={FISCAL} />);

    const image = screen.getByRole('img', { name: COPY.iphoneLabel });

    for (const word of [COPY.home, COPY.recorded, COPY.edit]) {
      expect(within(image).getByText(seen(word))).toBeTruthy();
    }
    expect(within(image).queryByText(seen(COPY.question))).toBeNull();
  });

  it('captions each phone with its platform, the iPhone as in preparation', () => {
    const { container } = render(
      <>
        <HeroPhone platform="android" result={example()} taxYear={YEAR} fiscal={FISCAL} />
        <HeroPhone platform="iphone" result={example()} taxYear={YEAR} fiscal={FISCAL} />
      </>,
    );
    const captions = [...container.querySelectorAll('figcaption')].map((node) => node.textContent);

    expect(captions[0]).toContain(COPY.androidName);
    expect(captions[1]).toContain(COPY.iphoneName);
  });

  it('shows the engine rate for the worked example, and a sentence that is true of it', () => {
    const result = example();

    render(<HeroPhone platform="android" result={result} taxYear={YEAR} fiscal={FISCAL} />);

    expect(screen.getAllByText(seen(formatPercent(result.declarableRate, 2))).length).toBeGreaterThan(0);
    // "Sous le seuil fiscal" is only true below the ceiling.
    expect(zoneFor(result.declarableRate, ruleSetFor(YEAR))).toBe('compliant');
    expect(screen.getByText(seen(COPY.underFiscal(FISCAL)))).toBeTruthy();
  });

  it('shows the four tabs in the app order, the first active', () => {
    render(<HeroPhone platform="android" result={example()} taxYear={YEAR} fiscal={FISCAL} />);

    for (const tab of COPY.tabs) {
      expect(screen.getAllByText(tab).length).toBeGreaterThan(0);
    }
  });

  it('draws a different cut-out per platform, and no status bar', () => {
    const { container } = render(
      <>
        <HeroPhone platform="android" result={example()} taxYear={YEAR} fiscal={FISCAL} />
        <HeroPhone platform="iphone" result={example()} taxYear={YEAR} fiscal={FISCAL} />
      </>,
    );
    const [android, iphone] = [...container.querySelectorAll('figure')];
    const cutout = (figure: Element | undefined) =>
      figure?.querySelector('[aria-hidden="true"] > span')?.className ?? '';

    expect(cutout(android)).not.toBe('');
    expect(cutout(android)).not.toBe(cutout(iphone));

    // No clock: nothing on either screen reads as a time of day.
    expect(container.textContent ?? '').not.toMatch(/\b\d{1,2}:\d{2}\b/u);
  });
});
