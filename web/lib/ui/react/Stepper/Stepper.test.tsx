// @vitest-environment jsdom
// web/lib/ui/react/Stepper/Stepper.test.tsx
//
// FW-CALCS-A2, R733. The stepper is a frame: the field is the caller's, the
// buttons call the caller's handlers, and both carry the caller's names. A
// button that submitted a GET form would send the reader away mid-edit, so
// both are asserted type="button".

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stepper } from './Stepper';

afterEach(cleanup);

const DOWN = 'Retirer une demi-journée';
const UP = 'Ajouter une demi-journée';
const FIELD = 'Jours';

describe('Stepper', () => {
  it('renders the caller’s field between two named, non-submitting buttons', () => {
    const onDecrease = vi.fn();
    const onIncrease = vi.fn();
    const { container } = render(
      <Stepper decreaseLabel={DOWN} increaseLabel={UP} onDecrease={onDecrease} onIncrease={onIncrease}>
        <input aria-label={FIELD} name="tt" type="text" defaultValue="3" />
      </Stepper>,
    );

    const [first, field, last] = [...(container.querySelector('[data-stepper]')?.children ?? [])];

    expect(first?.getAttribute('aria-label')).toBe(DOWN);
    expect(field?.getAttribute('name')).toBe('tt');
    expect(last?.getAttribute('aria-label')).toBe(UP);

    for (const button of screen.getAllByRole('button')) expect(button.getAttribute('type')).toBe('button');

    fireEvent.click(screen.getByRole('button', { name: DOWN }));
    fireEvent.click(screen.getByRole('button', { name: UP }));
    fireEvent.click(screen.getByRole('button', { name: UP }));

    expect(onDecrease).toHaveBeenCalledTimes(1);
    expect(onIncrease).toHaveBeenCalledTimes(2);
  });
});
