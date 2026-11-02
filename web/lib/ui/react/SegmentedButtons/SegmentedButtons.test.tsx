// @vitest-environment jsdom
// web/lib/ui/react/SegmentedButtons/SegmentedButtons.test.tsx
//
// FW-CALCS-A2, R750. The nameless toggle: a named group of type="button"
// segments with aria-pressed, carrying no name, its helper tied by
// aria-describedby, a change reported by value.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedButtons } from './SegmentedButtons';

afterEach(cleanup);

const LEGEND = 'Question';
const HELPER = 'Aide';
const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
] as const;

describe('SegmentedButtons', () => {
  it('is a group of pressed buttons carrying no name', () => {
    const onChange = vi.fn();

    render(<SegmentedButtons id="d" legend={LEGEND} helper={HELPER} options={OPTIONS} value="a" onChange={onChange} />);

    const group = screen.getByRole('group', { name: LEGEND });
    const buttons = screen.getAllByRole('button');

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(buttons.map((button) => button.getAttribute('type'))).toEqual(['button', 'button']);
    expect(buttons.map((button) => button.getAttribute('name'))).toEqual([null, null]);
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById(group.getAttribute('aria-describedby') ?? '')?.textContent).toBe(HELPER);

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));

    expect(onChange).toHaveBeenCalledWith('b');
  });
});
