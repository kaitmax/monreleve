// @vitest-environment jsdom
// web/lib/ui/react/PublicShell/aria-current.test.tsx
//
// FW-CALCS-A2: the shell marks the link to the page being read with
// aria-current="page" - and nothing else, and nothing at all on a page the nav
// does not list. The header is the shell's; this is the only change this task
// makes to it.
//
// The path is the router's (usePathname), stubbed here per case. Positive
// control: the same render with a path the nav DOES list marks exactly one
// link, so the "none" case below is an absence measured by an instrument that
// can see a presence.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CALCULATOR_PATH, COMPARATOR_PATH } from '@/lib/content/routes';
import { guideNavLinks } from '@/lib/guides/registry';

const path = vi.hoisted(() => ({ current: '/' as string | null }));

vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

const { PublicShell } = await import('./PublicShell');

afterEach(cleanup);

function marked(): string[] {
  return [...document.querySelectorAll('[aria-current]')].map(
    (element) => `${element.getAttribute('aria-current') ?? ''} ${element.getAttribute('href') ?? ''}`,
  );
}

const CONTENT = 'contenu';

describe('aria-current on the shell’s navigation (FW-CALCS-A2)', () => {
  it.each([CALCULATOR_PATH, COMPARATOR_PATH])('marks every link to %s, and only those', (current) => {
    path.current = current;
    render(
      <PublicShell guideLinks={guideNavLinks()}>
        <p>{CONTENT}</p>
      </PublicShell>,
    );

    const hits = marked();

    expect(hits.length).toBeGreaterThan(0);
    expect(new Set(hits)).toEqual(new Set([`page ${current}`]));
  });

  it('marks nothing on a page the navigation does not list', () => {
    path.current = '/cgu';
    render(
      <PublicShell guideLinks={guideNavLinks()}>
        <p>{CONTENT}</p>
      </PublicShell>,
    );

    expect(marked()).toEqual([]);
  });

  it('marks nothing when there is no router path', () => {
    path.current = null;
    render(
      <PublicShell guideLinks={guideNavLinks()}>
        <p>{CONTENT}</p>
      </PublicShell>,
    );

    expect(marked()).toEqual([]);
  });
});
