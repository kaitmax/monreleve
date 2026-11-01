// @vitest-environment jsdom
// web/lib/ui/react/Chip/Chip.test.tsx
//
// FW-CALCS-A2, R733. A chip is a checkbox under its paint: its name and value
// are what a GET form submits (`rythme=ma`), its label is its accessible name.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

afterEach(cleanup);

describe('Chip', () => {
  it('is a named checkbox, checked as told, reporting its change', () => {
    const onChange = vi.fn();

    render(<Chip name="rythme" value="ma" label="mardi" checked onChange={onChange} />);

    const box = screen.getByRole('checkbox', { name: 'mardi' });

    expect(box.getAttribute('name')).toBe('rythme');
    expect(box.getAttribute('value')).toBe('ma');
    expect(box).toHaveProperty('checked', true);

    fireEvent.click(box);

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
