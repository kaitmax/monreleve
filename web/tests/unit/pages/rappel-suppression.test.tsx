// @vitest-environment jsdom
//
// web/tests/unit/pages/rappel-suppression.test.tsx
//
// FW-DELAI-RAPPEL, R1002: the page the delete link in every reminder message
// opens - ONE button, a plain form, nothing deleted by opening it - rendered
// from the real page, inside the real shell for axe (SPEC 16), as the alert
// flow's landings are (tests/unit/pages/accessibility-alertes.test.tsx; Queue
// Ruling 24 item 6: the new landing gets the guards the alert landings get).
//
// What the database does when the button is pressed is
// tests/db/rappel-delai-suppression.test.ts's, through the POST handler.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import DeleteReminderPage, { metadata } from '@/app/(public)/rappel-delai/suppression/page';
import { RAPPEL_COPY } from '@/lib/fr/rappel';
import { guideNavLinks } from '@/lib/guides/registry';
import { DELETE_ENDPOINT } from '@/lib/rappel/landing';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

expect.extend(matchers);

afterEach(cleanup);

const TOKEN = 'b'.repeat(64);

/** The page as the server renders it for a query. */
const page = (query: Record<string, string>): Promise<React.ReactElement> =>
  DeleteReminderPage({ searchParams: Promise.resolve(query) });

describe('R1002: the delete link opens a page with one button', () => {
  it('is one form that POSTS the token to the delete endpoint, with one button', async () => {
    const { container } = render(<main>{await page({ token: TOKEN })}</main>);
    const forms = container.querySelectorAll('form');

    expect(forms).toHaveLength(1);
    expect(forms[0]?.getAttribute('method')).toBe('post');
    expect(forms[0]?.getAttribute('action')).toBe(DELETE_ENDPOINT);
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: RAPPEL_COPY.deletePage.button })).toBeTruthy();

    const hidden = container.querySelector('input[type="hidden"][name="token"]');

    expect(hidden?.getAttribute('value')).toBe(TOKEN);
  });

  it('says what the button does before it is pressed, and that nothing goes until it is', async () => {
    render(<main>{await page({ token: TOKEN })}</main>);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(RAPPEL_COPY.deletePage.heading);
    expect(document.body.textContent).toContain(RAPPEL_COPY.deletePage.body);
  });

  it('carries no token it was not given in the shape a message carries one', async () => {
    const queries: readonly Record<string, string>[] = [{}, { token: 'pas-un-jeton' }, { token: `${TOKEN}0` }];

    for (const query of queries) {
      const { container } = render(<main>{await page(query)}</main>);

      expect(container.querySelector('input[name="token"]')?.getAttribute('value')).toBe('');
      cleanup();
    }
  });

  it('is kept out of search engines, like the alert flow\'s landings', () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});

describe('jest-axe (SPEC 16)', () => {
  it('has no violations, in the shell', async () => {
    const { container } = render(
      <PublicShell guideLinks={guideNavLinks()}>
        <main>{await page({ token: TOKEN })}</main>
      </PublicShell>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
