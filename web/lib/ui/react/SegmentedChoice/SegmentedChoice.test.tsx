// @vitest-environment jsdom
// web/lib/ui/react/SegmentedChoice/SegmentedChoice.test.tsx
//
// FW-CALCS-A2, R733. The toggle is a radio group under its paint: one name
// (a SPEC 9.4 parameter on the calculator), one checked option, a legend that
// names the group, the helper tied to it - and a change reported by value.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedChoice } from './SegmentedChoice';

afterEach(cleanup);

const LEGEND = 'Avez-vous effectué des missions ?';
const HELPER = 'Les jours de mission sont comptés.';
const OPTIONS = [
  { value: 'Non', label: 'Non' },
  { value: 'Oui', label: 'Oui' },
] as const;

describe('SegmentedChoice', () => {
  it('is a named radio group with one checked option and its helper', () => {
    const onChange = vi.fn();

    render(
      <SegmentedChoice name="missions" legend={LEGEND} helper={HELPER} options={OPTIONS} value="Non" onChange={onChange} />,
    );

    const group = screen.getByRole('group', { name: LEGEND });
    const radios = screen.getAllByRole('radio');

    expect(radios.map((radio) => radio.getAttribute('name'))).toEqual(['missions', 'missions']);
    expect(screen.getByRole('radio', { name: 'Non' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Oui' })).toHaveProperty('checked', false);
    expect(document.getElementById(group.getAttribute('aria-describedby') ?? '')?.textContent).toBe(HELPER);

    fireEvent.click(screen.getByRole('radio', { name: 'Oui' }));

    expect(onChange).toHaveBeenCalledWith('Oui');
  });

  it('describes nothing when there is no helper', () => {
    render(<SegmentedChoice name="m" legend={LEGEND} options={OPTIONS} value="Oui" onChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: LEGEND }).hasAttribute('aria-describedby')).toBe(false);
  });
});
