// @vitest-environment jsdom
//
// web/tests/unit/pages/singletons.test.tsx
//
// RULING R119: A SPECIFIED-ONCE ELEMENT IS ASSERTED BY COUNT, NOT PRESENCE.
//
// THE DEFECT THAT PRODUCED THE RULING. FW12's increment 6 found the standing
// legal disclaimer rendering TWICE on the calculator, about 60 px apart - the
// panel's SPEC 9.3 slot 6 and a copy the page carried since increment 0 - and
// it had shipped through a green suite of 1633 tests. Every assertion about
// that sentence asked whether it was PRESENT. It was. Twice.
//
// The operator's statement of it: "Presence assertions are satisfiable by
// duplication."
//
// SO THIS FILE IS A CENSUS, and the numbers are the specification. Four
// singletons the spec names - the h1, the standing disclaimer, the contextual
// link, the primary action - counted on every live public route plus the 404.
//
// ZERO IS A COUNT TOO, and this is the half that makes the file more than a
// duplicate-detector. A rule of "at most one" is satisfied by a page that
// renders none, so every cell below is an exact number: /cgu has no contextual
// link because it is a legal document, and that 0 is asserted. If a legal page
// ever grows one, this file says so before a reviewer has to notice.
//
// RULING R124: THE DISCLAIMER'S COUNT IS PER REGION. Two copies of it on the
// calculator are a SPECIFICATION, not a duplication - "different jobs: the
// panel's is adjacent to the number and required by 9.3; the footer's survives
// with scripting off and covers every page" - so the assertion is exactly one
// inside the panel and exactly one inside the footer, rather than one on the
// page. A page-level count of 2 would have passed the duplicated version too.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CalculateurPage from '@/app/(public)/calculateur-teletravail-frontalier/page';
import CguPage from '@/app/(public)/cgu/page';
import ConfidentialitePage from '@/app/(public)/confidentialite/page';
import GuidesHubPage from '@/app/(public)/guides/page';
import HomePage from '@/app/(public)/page';
import MentionsPage from '@/app/(public)/mentions-legales/page';
import NotFound from '@/app/not-found';
import AlertesPage from '@/app/(public)/alertes/page';
import SourcesPage from '@/app/(public)/sources/page';
import { PUBLIC_ROUTES, ctaHrefIfLive } from '@/lib/content/routes';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { LEGAL_COPY } from '@/lib/fr/legal';
import { RESULT_COPY } from '@/lib/fr/result';
import { SHELL_COPY } from '@/lib/fr/shell';
import type { Status } from '@/lib/ui/core';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

afterEach(cleanup);

/**
 * How many times a string occurs in some text.
 *
 * SPLIT RATHER THAN A REGEXP, because these are French sentences carrying
 * U+00A0 and punctuation that would need escaping, and an escaping mistake
 * in a counter is a count of zero that reads as a clean bill of health.
 */
const occurrences = (text: string, needle: string): number =>
  text.split(needle).length - 1;

interface Expected {
  readonly label: string;
  readonly render: () => void;
  /** SPEC 9.3's one-link-by-status slot. Only the calculator has one. */
  readonly contextualLinks: number;
  /** FD1's primary action. The calculator's Calculer button. */
  readonly primaryActions: number;
}

/**
 * THE CENSUS. Every live public route, plus the 404.
 *
 * Rendered inside PublicShell, because three of the four singletons are
 * properties of the ASSEMBLED document: the h1 is the page's while the shell
 * deliberately emits none, and the footer's disclaimer is the shell's.
 */
const PAGES: readonly Expected[] = [
  {
    label: '/',
    render: () => {
      render(
        <PublicShell>
          <HomePage />
        </PublicShell>,
      );
    },
    contextualLinks: 0,
    primaryActions: 0,
  },
  {
    label: '/calculateur-teletravail-frontalier',
    render: () => {
      render(
        <PublicShell>
          <CalculateurPage />
        </PublicShell>,
      );
    },
    // No result yet, so the panel is not rendered and its link slot with it.
    // The state WITH a result is counted separately below, where the region
    // split matters.
    contextualLinks: 0,
    primaryActions: 1,
  },
  {
    label: '/alertes',
    render: () => {
      render(
        <PublicShell>
          <AlertesPage />
        </PublicShell>,
      );
    },
    contextualLinks: 0,
    // ZERO, and the field name is the reason: this census counts the
    // CALCULATOR's Calculer button, not any primary-styled control. The
    // capture form has a submit of its own and it is not that button.
    primaryActions: 0,
  },
  {
    label: '/sources',
    render: () => {
      render(
        <PublicShell>
          <SourcesPage />
        </PublicShell>,
      );
    },
    contextualLinks: 0,
    primaryActions: 0,
  },
  {
    label: '/mentions-legales',
    render: () => {
      render(
        <PublicShell>
          <MentionsPage />
        </PublicShell>,
      );
    },
    contextualLinks: 0,
    primaryActions: 0,
  },
  {
    label: '/confidentialite',
    render: () => {
      render(
        <PublicShell>
          <ConfidentialitePage />
        </PublicShell>,
      );
    },
    contextualLinks: 0,
    primaryActions: 0,
  },
  {
    label: '/cgu',
    render: () => {
      render(
        <PublicShell>
          <CguPage />
        </PublicShell>,
      );
    },
    contextualLinks: 0,
    primaryActions: 0,
  },
  {
    label: '/guides',
    render: () => {
      render(
        <PublicShell>
          <GuidesHubPage />
        </PublicShell>,
      );
    },
    // A hub is a list of articles. No result panel, and its CTA to the
    // calculator lives on the articles rather than here.
    contextualLinks: 0,
    primaryActions: 0,
  },
  {
    label: '404',
    render: () => {
      render(
        <PublicShell>
          <NotFound />
        </PublicShell>,
      );
    },
    contextualLinks: 0,
    primaryActions: 0,
  },
];

/**
 * THE ROUTES THIS CENSUS CANNOT RENDER, named rather than missing.
 *
 * FW17 made three guide articles live and they cannot be counted here: the
 * article route is an ASYNC server component that compiles MDX, and jsdom
 * runs neither. That is the same limitation
 * tests/unit/pages/guide-section-order.test.tsx works around by rendering a
 * copy of the head markup.
 *
 * So they are counted where they CAN be - against served HTML, in
 * e2e/guides.spec.ts, which asserts the single h1 and the single standing
 * disclaimer on a real article.
 *
 * THE SET IS ASSERTED TO BE EXACTLY THE ARTICLE ROUTES, so FW18's four
 * further guides land inside a stated exemption rather than widening a hole -
 * and so that a NON-guide route can never be quietly added to it.
 */
const COUNTED_IN_E2E: readonly string[] = [
  '/guides/teletravail-frontalier-40-pourcent',
  '/guides/seuil-social-49-9-pourcent',
  '/guides/jours-de-mission-hors-suisse',
];

describe('the census covers every live public route (R119)', () => {
  it('has a row for each one, and the 404', () => {
    // WITHOUT THIS THE FILE SHRINKS SILENTLY. A route added to the registry
    // and not to the table would simply not be counted, which is the shape
    // of hole R63 exists to catch and the shape the FW11 suite floor drifted
    // into.
    const live = PUBLIC_ROUTES.filter((route) => route.status === 'live').map(
      (route) => route.path,
    );
    const counted = [
      ...PAGES.map((page) => page.label).filter((label) => label !== '404'),
      ...COUNTED_IN_E2E,
    ];

    expect([...counted].sort()).toEqual([...live].sort());
  });

  it('exempts only guide ARTICLES, and only because jsdom cannot run them', () => {
    // The exemption is a statement about what jsdom can render, not a
    // convenience. Anything in it that is not an article under /guides/ is a
    // route somebody stopped counting.
    const notAnArticle = COUNTED_IN_E2E.filter((path) => !path.startsWith('/guides/'));

    expect(notAnArticle, notAnArticle.join(', ')).toEqual([]);

    // And the hub itself IS counted here - it is a synchronous component.
    expect(PAGES.map((page) => page.label)).toContain('/guides');
  });
});

describe('exactly one h1 per page (R119)', () => {
  it.each(PAGES)('$label', ({ render: mount }) => {
    // The shell emits none on purpose so the page can own it. Two h1s is the
    // classic outcome of a shell that helps.
    mount();

    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });
});

describe('the standing disclaimer, counted per region (R119, R124)', () => {
  it.each(PAGES)('$label has exactly one, in the footer', ({ render: mount }) => {
    mount();

    const footer = document.querySelector('footer');
    const main = document.querySelector('main');

    expect(occurrences(footer?.textContent ?? '', LEGAL_COPY.standing)).toBe(1);
    expect(occurrences(main?.textContent ?? '', LEGAL_COPY.standing)).toBe(0);
  });

  it('the calculator with a result has one in the panel AND one in the footer', () => {
    // R124: two copies here are the specification. The panel's sits against
    // the number it qualifies (SPEC 9.3 item 6); the footer's is on every
    // page and survives with scripting off (SPEC 9.1 $legal-01).
    render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.canton.label), {
      target: { value: 'GE' },
    });
    fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.days.label), {
      target: { value: '110' },
    });

    const panel = document.querySelector('[data-panel="legal"]');
    const footer = document.querySelector('footer');
    const main = document.querySelector('main');

    expect(occurrences(panel?.textContent ?? '', LEGAL_COPY.standing)).toBe(1);
    expect(occurrences(footer?.textContent ?? '', LEGAL_COPY.standing)).toBe(1);

    // And ONE in main altogether, which is the assertion the duplicate
    // failed: the panel's copy is the only one inside main.
    expect(occurrences(main?.textContent ?? '', LEGAL_COPY.standing)).toBe(1);
  });

  it('counts 2 on the whole document, and that number is deliberate', () => {
    // Stated as a number rather than left implicit, so the day somebody
    // decides one of the two should go, this is where the decision is
    // recorded and not a test that quietly starts passing at 1.
    render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.canton.label), {
      target: { value: 'GE' },
    });
    fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.days.label), {
      target: { value: '110' },
    });

    expect(occurrences(document.body.textContent ?? '', LEGAL_COPY.standing)).toBe(2);
  });
});

describe('the contextual link: exactly one, by Status (R119)', () => {
  it.each(PAGES)('$label renders $contextualLinks', ({ render: mount, contextualLinks }) => {
    mount();

    const slots = document.querySelectorAll('[data-panel="link"]');

    expect(slots).toHaveLength(contextualLinks);
  });

  it('is one, and only one, in every status the panel can be in', () => {
    // FOUR STATUSES, ONE SLOT, ONE CHILD. SPEC 9.3 says "exactly one
    // contextual link", and the way that goes wrong is a second one appearing
    // for a status that also matches some other condition - so the count is
    // asserted per status rather than once.
    const STATES: ReadonlyArray<readonly [string, string, string]> = [
      ['compliant', '72', '0'],
      ['regime-lost', '110', '0'],
      ['social-switch', '144', '5'],
    ];

    for (const [name, days, missions] of STATES) {
      render(
        <PublicShell>
          <CalculateurPage />
        </PublicShell>,
      );

      fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.canton.label), {
        target: { value: 'GE' },
      });
      fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.days.label), {
        target: { value: days },
      });

      if (missions !== '0') {
        fireEvent.click(screen.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.yes }));
        fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.missions.france.label), {
          target: { value: missions },
        });
      }

      const slot = document.querySelector('[data-panel="link"]');

      expect(slot, name).not.toBeNull();
      expect(slot?.children, name).toHaveLength(1);

      // And no two of the four texts on screen at once, which is what
      // "exactly one" is protecting.
      const text = document.body.textContent ?? '';
      const showing = Object.values(RESULT_COPY.links).filter((link) =>
        text.includes(link.text),
      );

      expect(showing, name).toHaveLength(1);

      cleanup();
    }
  });

  it('resolves to a real anchor for the three statuses FW17 wrote guides for', () => {
    // AC3. FW12 shipped this slot rendering TEXT, because all four
    // destinations were `planned` and R85 refuses an anchor to a route that
    // does not exist - "an anchor here would promise a 404 from the one place
    // a reader has just been told something about their own money".
    //
    // FW17 built three of the four. The panel needed no edit: ctaHrefIfLive
    // decides, and the routes moved. This is what proves the decision
    // actually flipped, from the rendered DOM rather than from the registry
    // that feeds it - the registry is asserted separately in
    // tests/unit/guides/hub.test.ts.
    const STATES: ReadonlyArray<readonly [Status, string, string]> = [
      ['regime-lost', '110', '0'],
      ['social-switch', '144', '5'],
    ];

    for (const [status, days, missions] of STATES) {
      render(
        <PublicShell>
          <CalculateurPage />
        </PublicShell>,
      );

      fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.canton.label), {
        target: { value: 'GE' },
      });
      fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.days.label), {
        target: { value: days },
      });

      if (missions !== '0') {
        fireEvent.click(screen.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.yes }));
        fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.missions.france.label), {
          target: { value: missions },
        });
      }

      const anchor = document.querySelector('[data-panel="link"] a');

      expect(anchor, status).not.toBeNull();
      expect(anchor?.getAttribute('href'), status).toBe(RESULT_COPY.links[status].href);

      cleanup();
    }
  });

  it('still names WITHOUT linking for compliant, whose target is not built', () => {
    // THE FOURTH, AND IT IS STILL PLANNED. /releve-annuel is FW20's. Asserted
    // rather than left implicit, so that "three of four resolve" is a
    // measurement instead of a description - and so that whoever ships
    // /releve-annuel has one failing test telling them to check this panel.
    render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.canton.label), {
      target: { value: 'GE' },
    });
    fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.days.label), {
      target: { value: '72' },
    });

    const slot = document.querySelector('[data-panel="link"]');

    expect(slot?.querySelector('a')).toBeNull();

    // R154: the LINK TEXT is a constant linkPending cannot launder, so this
    // fails if the interpolation empties; the equality below then pins the
    // whole sentence. FW17 wrote only the equality, which would have passed
    // against a linkPending that dropped its argument.
    expect(slot?.textContent).toContain(RESULT_COPY.links.compliant.text);
    expect(slot?.textContent).toBe(RESULT_COPY.linkPending(RESULT_COPY.links.compliant.text));
  });
});

describe('the primary action: exactly one (R119)', () => {
  it.each(PAGES)('$label renders $primaryActions', ({ render: mount, primaryActions }) => {
    mount();

    const buttons = screen.queryAllByRole('button', {
      name: CALCULATEUR_COPY.result.calculate,
    });

    expect(buttons).toHaveLength(primaryActions);
  });

  it('stays one once there is a result', () => {
    // The button is FD1's affordance for people who expect a form to have
    // one, and the panel appearing beneath it must not bring a second.
    render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    fireEvent.change(screen.getByLabelText(CALCULATEUR_COPY.form.canton.label), {
      target: { value: 'GE' },
    });

    expect(
      screen.queryAllByRole('button', { name: CALCULATEUR_COPY.result.calculate }),
    ).toHaveLength(1);
  });

  it('counts the shell CTA as zero while its target is planned (R85)', () => {
    // THE OTHER PRIMARY ACTION, and it is absent by design rather than by
    // omission. SHELL_COPY.ctaHref is /application, which is `status:
    // 'planned'`, so ctaHrefIfLive returns null and the header renders no
    // anchor at all. Asserted as a pair - the registry says planned, the DOM
    // shows none - so the day /application ships, this fails and says the
    // count has to be reconsidered rather than silently becoming 1.
    render(
      <PublicShell>
        <HomePage />
      </PublicShell>,
    );

    expect(ctaHrefIfLive(SHELL_COPY.ctaHref)).toBeNull();
    expect(screen.queryAllByRole('link', { name: SHELL_COPY.cta })).toHaveLength(0);
  });
});
