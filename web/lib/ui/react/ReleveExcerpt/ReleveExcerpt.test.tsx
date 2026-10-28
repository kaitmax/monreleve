// @vitest-environment jsdom
// web/lib/ui/react/ReleveExcerpt/ReleveExcerpt.test.tsx
//
// R714: the excerpt is a SAMPLE and says so; its days are lib/content/home.ts's
// data, formatted by the product's own formatters; each country dot sits
// beside its words; the table scrolls inside its own focusable box (R159).

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RELEVE_SAMPLE } from '@/lib/content/home';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { HOME_COPY } from '@/lib/fr/home';
import { formatDate, formatDateTime } from '@/lib/ui/core';
import { ReleveExcerpt } from './ReleveExcerpt';

afterEach(cleanup);

const COPY = HOME_COPY.excerpt;

describe('the releve excerpt (R714)', () => {
  it('is a figure named as a sample, with the sample caption', () => {
    render(<ReleveExcerpt state={PRODUCT_STATE} />);

    const figure = screen.getByRole('figure', { name: COPY.label });

    expect(within(figure).getByText(COPY.caption(PRODUCT_STATE))).toBeTruthy();
  });

  it('names the year, the holder and the verification code of the sample', () => {
    render(<ReleveExcerpt state={PRODUCT_STATE} />);

    expect(screen.getByText(COPY.title)).toBeTruthy();
    expect(screen.getByText(COPY.subtitle(RELEVE_SAMPLE.year))).toBeTruthy();
    expect(screen.getByText(COPY.code)).toBeTruthy();
  });

  it('shows every sample day, its date and its recording instant in the product format', () => {
    render(<ReleveExcerpt state={PRODUCT_STATE} />);

    const rows = screen.getAllByRole('row').slice(1);

    expect(rows).toHaveLength(RELEVE_SAMPLE.days.length);

    RELEVE_SAMPLE.days.forEach((day, index) => {
      const cells = within(rows[index] as HTMLElement).getAllByRole('cell');

      expect(cells[0]?.textContent).toBe(formatDate(day.day));
      expect(cells[1]?.textContent).toBe(COPY.kinds[day.kind]);
      expect(cells[2]?.textContent).toBe(formatDateTime(day.recordedAt));
    });
  });

  it('puts the Paris clock in the column heading, once', () => {
    render(<ReleveExcerpt state={PRODUCT_STATE} />);

    expect(screen.getByRole('columnheader', { name: COPY.columns.recorded })).toBeTruthy();
  });

  it('gives each day its country dots beside its words, never alone', () => {
    const { container } = render(<ReleveExcerpt state={PRODUCT_STATE} />);
    const expected = { swiss: 1, home: 1, split: 2, absence: 0 } as const;

    const rows = [...container.querySelectorAll('tbody tr')];

    RELEVE_SAMPLE.days.forEach((day, index) => {
      const dayCell = rows[index]?.querySelectorAll('td')[1];
      const dots = dayCell?.querySelectorAll('span[aria-hidden="true"]') ?? [];

      expect(dots.length, day.day).toBe(expected[day.kind]);
      expect(dayCell?.textContent).toBe(COPY.kinds[day.kind]);
    });

    // Non-vacuity: the sample has both countries and a day with none.
    expect(container.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThan(2);
  });

  it('scrolls the table in its own named, focusable region (R159)', () => {
    render(<ReleveExcerpt state={PRODUCT_STATE} />);

    const region = screen.getByRole('region', { name: COPY.label });

    expect(region.getAttribute('tabindex')).toBe('0');
    expect(within(region).getByRole('table')).toBeTruthy();
  });

  it('renders the summer instants as Paris wall-clock time', () => {
    // 16:42Z on 19 October 2026 is 18:42 in Paris (UTC+2 until 25 October).
    expect(formatDateTime(RELEVE_SAMPLE.days[0].recordedAt)).toContain('18:42');
  });
});
