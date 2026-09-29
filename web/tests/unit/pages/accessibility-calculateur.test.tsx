// @vitest-environment jsdom
//
// web/tests/unit/pages/accessibility-calculateur.test.tsx
//
// FW11 increment 5: zero axe violations on the calculator, in every state it
// can be in.
//
// A SEPARATE FILE FROM accessibility.test.tsx, which covers the three legal
// pages. Those are static documents: one render each, two entity states, and
// the assertion is about composition. This page has STATES - a form that
// reveals fields, opens a disclosure, and swaps a number for an error - and
// each of them assembles a different document. The four the increment names
// are empty, filled, error and revealed.
//
// WHY THE STATES ARE THE POINT. An accessible empty form proves very little
// about the same form once it has grown two mission fields, an accordion full
// of radio groups and a live region announcing a rate. The defects that
// actually appear on this page appear in one state and not the others: a
// duplicate id when a revealed field reuses one, an aria-controls pointing at
// a node that is only sometimes rendered, a label orphaned when its control
// unmounts, a live region left without an accessible name.
//
// RENDERED INSIDE PublicShell, like the legal pages, because a landmark
// nested in another landmark and a second h1 are properties of the assembly
// and axe cannot see them from the content alone.
//
// WHAT AXE CANNOT SEE HERE, so the green is not read as more than it is: jsdom
// has no layout, so colour-contrast comes back INCOMPLETE and every size is
// unmeasurable. The 44 px touch targets are asserted from the token in
// calculateur-form.test.tsx and shown in increment 5's baselines; contrast is
// answered by tests/unit/tokens/contrast.test.ts.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import CalculateurPage from '@/app/(public)/calculateur-teletravail-frontalier/page';
import { readingAnchor } from '@/lib/content/provisional';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { RESULT_COPY } from '@/lib/fr/result';
import { SHARE_COPY } from '@/lib/fr/params';
import { guideNavLinks } from '@/lib/guides/registry';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

expect.extend(matchers);

afterEach(cleanup);

// One state stubs navigator to give the device a share sheet. Left in place
// it would leak into every test after it in this file - the same shape as
// the address bar leak FW13 increment 4 found, and the reason
// tests/setup/browser-state.ts exists.
afterEach(() => {
  vi.unstubAllGlobals();
});

const FORM = CALCULATEUR_COPY.form;
const RESULT = CALCULATEUR_COPY.result;

const mount = () => render(<PublicShell guideLinks={guideNavLinks()}>{<CalculateurPage />}</PublicShell>);

/** Land on the page the way a shared link does: URL first, then render. */
const arriveWith = (search: string) => {
  window.history.replaceState(
    null,
    '',
    `/calculateur-teletravail-frontalier${search}`,
  );
};

/** Mount a state: its `before` runs first, because it shapes the first render. */
const mountState = (state: PageState) => {
  state.before?.();

  return mount();
};

const setValue = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const click = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
};

const pick = (name: string) => {
  fireEvent.click(screen.getByRole('radio', { name }));
};

/**
 * A state of this page.
 *
 * `before` runs BEFORE the mount and `reach` after it, because FW13 added
 * two states that are not reachable by using the form: a link notice exists
 * only when the page was ENTERED with a mangled URL, and the native share
 * button exists only where navigator.share does. Both are conditions of the
 * first render, and a hook that ran after it would be testing a page the
 * reader never sees.
 */
interface PageState {
  readonly name: string;
  readonly before?: () => void;
  readonly reach: () => void;
}

/**
 * Every state this page can be in, each as steps rather than as markup.
 *
 * FUNCTIONS, NOT PRE-RENDERED NODES, because all but two of them are reached
 * by USING the form. Constructing the DOM another way would test a shape the
 * product cannot actually get into. The two exceptions carry a `before`: they
 * are reached by ARRIVING - at a mangled URL, or on a device with a share
 * sheet - which is a condition of the first render rather than a step after
 * it.
 */
const STATES: ReadonlyArray<PageState> = [
  {
    name: 'empty - nothing chosen yet',
    reach: () => undefined,
  },
  {
    name: 'filled - Geneva case (c), a rate on screen',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      setValue(FORM.days.label, '84');
      pick(FORM.missions.yes);
      setValue(FORM.missions.france.label, '24');
    },
  },
  {
    name: 'error - a field marked invalid and a message under it',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      setValue(FORM.rate.label, '0');
    },
  },
  {
    name: 'revealed - missions shown and the accordion open',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      pick(FORM.missions.yes);
      click(FORM.advanced.summary);
      pick(FORM.method.exact);
    },
  },

  // ---------------------------------------------------------------------
  // FW12 increment 6: the RESULT PANEL's own states.
  //
  // The four above are states of the FORM, and FW11's panel was a rate and
  // a placeholder. The panel now assembles seven slots whose contents
  // differ by status - a badge with a different icon, a rail with a
  // different fill, two tiles that swap their labels, between zero and
  // three banners, and a contextual link that changes destination - so
  // "the calculator has no axe violations" needed re-establishing over the
  // states the panel can be in rather than the states the form can.
  //
  // 'filled' above IS mission-exposure (Geneva case (c)); it keeps its
  // name because other assertions in this file reach for it by index.
  // ---------------------------------------------------------------------
  {
    name: 'compliant - under both ceilings, no banner but the A1 one',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      setValue(FORM.days.label, '72');
    },
  },
  {
    name: 'regime-lost - past the fiscal ceiling, one tile negative',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      setValue(FORM.days.label, '110');
    },
  },
  {
    name: 'social-switch - past both, two tiles negative and three banners',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      setValue(FORM.days.label, '144');
      pick(FORM.missions.yes);
      setValue(FORM.missions.france.label, '5');
    },
  },
  {
    name: 'notice-P1 - the imputation order, with its link to /sources',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      setValue(FORM.days.label, '40');
      pick(FORM.missions.yes);
      setValue(FORM.missions.france.label, '6');
      setValue(FORM.missions.thirdState.label, '4');
    },
  },
  {
    name: 'notice-P3 - the exact method at part time',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      setValue(FORM.days.label, '40');
      setValue(FORM.rate.label, '80');
      click(FORM.advanced.summary);
      pick(FORM.method.exact);
    },
  },

  // ---------------------------------------------------------------------
  // FW13 increment 6: the two states a URL produces.
  //
  // Everything above is reached by USING the form, which is how a reader who
  // typed their way here gets there. The growth mechanic produces readers who
  // did not: they opened a link somebody pasted into a Facebook thread, and
  // the page they meet has an element none of the nine states above contain -
  // a notice saying which parts of that link did not survive the platform.
  //
  // The share row is the other half. Its copy button is always there, and the
  // native one exists only where navigator.share does - which on a phone is
  // most readers and in jsdom is nobody, so it needs saying out loud.
  // ---------------------------------------------------------------------
  {
    name: 'link-notice - entered through a mangled URL',
    before: () => {
      // The Facebook case: the ampersand came back as an HTML entity, so tt
      // never arrived and an unknown param named after the entity did.
      arriveWith('?canton=GE&amp;tt=84&utm_source=facebook');
    },
    reach: () => undefined,
  },
  {
    name: 'share-native - the device has a share sheet',
    before: () => {
      vi.stubGlobal('navigator', { ...navigator, share: () => Promise.resolve() });
    },
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      setValue(FORM.days.label, '84');
    },
  },
];

describe('the calculator has no axe violations in any state', () => {
  it('covers the states the two increments name', () => {
    // Without this the loop could pass by shrinking to nothing - the same
    // vacuous-pass shape ruling R63 exists to catch.
    //
    // FOUR FORM STATES FROM FW11, FIVE PANEL STATES FROM FW12 INCREMENT 6.
    // 'filled' is mission-exposure, so the four statuses are covered by
    // filled + compliant + regime-lost + social-switch and the two notice
    // triggers by the last two.
    // FW13 increment 6 appends the two states a URL produces, which no
    // amount of using the form can reach.
    expect(STATES).toHaveLength(11);
    expect(STATES.map((state) => state.name.split(' ')[0])).toEqual([
      'empty',
      'filled',
      'error',
      'revealed',
      'compliant',
      'regime-lost',
      'social-switch',
      'notice-P1',
      'notice-P3',
      'link-notice',
      'share-native',
    ]);
  });

  for (const state of STATES) {
    it(state.name, async () => {
      const { container } = mountState(state);

      state.reach();

      expect(await axe(container)).toHaveNoViolations();
    });
  }

  it('really did reach the states, so the runs above were not all the same page', () => {
    // THE ASSERTION THAT KEEPS THE LOOP HONEST. axe passes on an empty form
    // four times over just as happily as on four different ones, so a broken
    // `reach` - a renamed label, a control that stopped existing - would turn
    // this whole describe into one test repeated. Each state is checked for
    // something only it contains.
    const { unmount: closeEmpty } = mount();

    expect(document.body.textContent).toContain(RESULT.empty);
    closeEmpty();
    cleanup();

    mount();
    STATES[1]?.reach();

    expect(document.body.textContent).toContain(`39,16${String.fromCharCode(0x00a0)}%`);
    cleanup();

    mount();
    STATES[2]?.reach();

    expect(screen.getByLabelText(FORM.rate.label).getAttribute('aria-invalid')).toBe('true');
    cleanup();

    mount();
    STATES[3]?.reach();

    expect(screen.getByLabelText(FORM.method.totalLabel)).toBeDefined();
  });

  it('reached each PANEL state too, each by something only it contains', () => {
    // THE SAME PROBLEM, ONE LEVEL UP AND WORSE. Five more states were added
    // in increment 6 and axe passes on any of them; five `reach` functions
    // that all silently produced the compliant panel would read as five
    // states covered. Each is identified by the one thing that distinguishes
    // it - the contextual link is chosen by Status, so three of the four
    // statuses name themselves, and the notices name their reading in a
    // fragment.
    const probes: ReadonlyArray<{ readonly index: number; readonly find: () => void }> = [
      {
        index: 4,
        find: () => {
          expect(document.body.textContent).toContain(RESULT_COPY.links.compliant.text);
        },
      },
      {
        index: 5,
        find: () => {
          expect(document.body.textContent).toContain(RESULT_COPY.links['regime-lost'].text);
        },
      },
      {
        index: 6,
        find: () => {
          expect(document.body.textContent).toContain(RESULT_COPY.links['social-switch'].text);
        },
      },
      {
        index: 7,
        find: () => {
          expect(
            document.querySelector(`a[href="/sources#${readingAnchor('P1')}"]`),
          ).not.toBeNull();
        },
      },
      {
        index: 8,
        find: () => {
          expect(
            document.querySelector(`a[href="/sources#${readingAnchor('P3')}"]`),
          ).not.toBeNull();
        },
      },
    ];

    // TIED TO WHICH STATES, NOT TO HOW MANY. This was STATES.length - 4,
    // which was five while the panel states were the last five - and FW13
    // appended two more after them, which that arithmetic would have
    // demanded probes for. The probes are about the PANEL, so they name the
    // panel states.
    expect(probes.map((probe) => probe.index)).toEqual([4, 5, 6, 7, 8]);

    for (const probe of probes) {
      mount();
      STATES[probe.index]?.reach();
      probe.find();
      cleanup();
    }
  });

  it('reached the two URL states too, each by something only it contains', () => {
    // THE SAME GUARD AS ABOVE, FOR THE STATES FW13 ADDED. axe passes on a page
    // with no notice exactly as happily as on one with a notice, so a `before`
    // hook that silently stopped working - a renamed param, a stubbed
    // navigator that no longer reaches the effect - would turn two green axe
    // runs into two more copies of the empty state.
    const linkNotice = STATES[9];
    const shareNative = STATES[10];

    expect(linkNotice?.name).toContain('link-notice');
    expect(shareNative?.name).toContain('share-native');

    mountState(linkNotice as PageState);
    linkNotice?.reach();

    const notice = document.querySelector('[data-notice="params"]');

    expect(notice).not.toBeNull();

    // Named, not merely present: the notice exists to say WHICH parts of the
    // link did not survive, and "amp;tt" is what the entity mangling leaves.
    expect(notice?.textContent).toContain('amp;tt');
    cleanup();

    // And the native button, which jsdom does not have and a phone does.
    expect(screen.queryByRole('button', { name: SHARE_COPY.share })).toBeNull();

    mountState(shareNative as PageState);
    shareNative?.reach();

    expect(screen.getByRole('button', { name: SHARE_COPY.share })).toBeTruthy();
    cleanup();
  });

  it('shows a different contextual link in each status, not the same one', () => {
    // NON-VACUITY FOR THE THREE ABOVE. If the panel rendered one status's
    // link regardless, each assertion would still pass in whichever state
    // matched it - so the four texts are checked to be four different
    // strings, which is what makes "only it contains" true.
    const texts = [
      RESULT_COPY.links.compliant.text,
      RESULT_COPY.links['mission-exposure'].text,
      RESULT_COPY.links['regime-lost'].text,
      RESULT_COPY.links['social-switch'].text,
    ];

    expect(new Set(texts).size).toBe(4);

    // And mission-exposure's own link really is on the 'filled' state, which
    // is the one status not covered by the probes above.
    mount();
    STATES[1]?.reach();

    expect(document.body.textContent).toContain(RESULT_COPY.links['mission-exposure'].text);
    expect(document.body.textContent).not.toContain(RESULT_COPY.links.compliant.text);
  });
});

describe('the assembled document, in every state', () => {
  for (const state of STATES) {
    it(`${state.name}: one h1, no level skipped`, () => {
      // Asserted separately from axe because axe's heading-order rule is not
      // in its default set, and because the failure is specific here: the
      // shell emits no h1 so the page can, and the result region added an h2
      // in increment 4 which sits between the page's h1 and the footer's own
      // h2 columns.
      const { container } = mountState(state);

      state.reach();

      const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((element) =>
        Number.parseInt(element.tagName.slice(1), 10),
      );

      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);

      for (let index = 1; index < levels.length; index += 1) {
        const previous = levels[index - 1] ?? 1;
        const current = levels[index] ?? 1;

        expect(current - previous, `h${previous} followed by h${current}`).toBeLessThanOrEqual(1);
      }
    });
  }
});

describe('every ARIA reference points at something that exists, in any state', () => {
  // FOUND BY A MUTATION PROBE THAT PASSED. Planting
  // aria-labelledby="no-such-id" on the panel's warning list left all 31
  // tests green: axe's default set in this harness does not flag an ARIA
  // reference to a missing element. A link with no text it catches
  // immediately - that probe reddened seven states - so the panel IS being
  // scanned, and this is a hole in the rule set rather than in the coverage.
  //
  // WHICH IS THE DEFECT THIS FILE'S OWN HEADER NAMES: "an aria-controls
  // pointing at a node that is only sometimes rendered". The accordion's
  // button controls a region that unmounts, every FieldGroup describes its
  // control by an error node that exists only while invalid, and the panel
  // labels itself by a heading id. All of those are references across a
  // conditional boundary, and a stale one is silence in a screen reader and
  // nothing at all on screen.
  const REFERENCING = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-details'];

  for (const state of STATES) {
    it(state.name, () => {
      const { container } = mountState(state);

      state.reach();

      const present = new Set(
        [...container.querySelectorAll('[id]')].map((element) => element.id),
      );
      const dangling: string[] = [];
      let references = 0;

      for (const attribute of REFERENCING) {
        for (const element of container.querySelectorAll(`[${attribute}]`)) {
          // The attributes are ID LISTS, space separated, and a single
          // missing entry in a list of three is the interesting case.
          for (const id of (element.getAttribute(attribute) ?? '').split(' ')) {
            if (id === '') continue;

            references += 1;

            if (!present.has(id)) dangling.push(`${attribute}="${id}"`);
          }
        }
      }

      expect(dangling, `dangling: ${dangling.join(', ')}`).toEqual([]);

      // Non-vacuity: this page has these attributes, so a selector that
      // stopped matching cannot pass as a clean bill of health.
      expect(references, 'no ARIA references found at all').toBeGreaterThan(2);
    });
  }
});

describe('no id is used twice, in any state', () => {
  // NOT COVERED BY AXE'S DEFAULT SET, and the most likely defect on a form
  // that renders fields conditionally: FieldGroup derives every id it needs
  // from the caller's id, so two fields sharing one would silently point two
  // labels and two error messages at the same control.
  for (const state of STATES) {
    it(state.name, () => {
      const { container } = mountState(state);

      state.reach();

      const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
      const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);

      expect(duplicated, `duplicated: ${duplicated.join(', ')}`).toEqual([]);
      expect(ids.length).toBeGreaterThan(3);
    });
  }
});
