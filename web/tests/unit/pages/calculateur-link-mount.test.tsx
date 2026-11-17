// @vitest-environment jsdom
//
// web/tests/unit/pages/calculateur-link-mount.test.tsx
//
// FW-PREHYDRATION-SITES, R1057: THE SHARED LINK ON A CLIENT RENDER.
//
// e2e/prehydration.spec.ts proves the mount read on a HYDRATED island: the
// server's HTML is there, and a control still holding what the first render put
// in it takes the link's value. An in-site navigation to the calculator does
// not hydrate - React creates the form on the client - and the controls carry
// no server attributes at all (React sets a controlled select's `selected`
// property, never `defaultSelected`). Judging "touched" by those attributes
// would read every control as changed there and put the defaults back over
// the link. This file is that path: render() mounts on the client, with the
// link in the location, and the link's values must be what the form shows.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';

afterEach(cleanup);

const TAX_YEAR = 2026;
const PATH = '/calculateur-teletravail-frontalier';

const field = <T extends HTMLElement>(container: HTMLElement, selector: string): T => {
  const element = container.querySelector<T>(selector);

  if (element === null) throw new Error(`no ${selector}`);

  return element;
};

describe('a shared link opened by a client render (R1057)', () => {
  it('shows the link in every control it names', () => {
    window.history.replaceState(null, '', `${PATH}?canton=GE&tt=84&mfr=24&decompte=dj&rythme=ma`);

    const { container } = render(<CalculatorForm taxYear={TAX_YEAR} />);

    expect(field<HTMLSelectElement>(container, '#canton').value).toBe('GE');
    expect(field<HTMLInputElement>(container, '#jours-teletravail').value).toBe('84');
    expect(field<HTMLInputElement>(container, '#missions-france').value).toBe('24');
    expect(field<HTMLInputElement>(container, 'input[name="rythme"][value="ma"]').checked).toBe(true);
  });

  it('with no link, shows the defaults', () => {
    window.history.replaceState(null, '', PATH);

    const { container } = render(<CalculatorForm taxYear={TAX_YEAR} />);

    expect(field<HTMLSelectElement>(container, '#canton').value).toBe('');
    expect(container.querySelector('#missions-france')).toBeNull();
  });
});
