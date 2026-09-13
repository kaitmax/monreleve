// @vitest-environment jsdom
//
// web/tests/unit/pages/accessibility-alertes.test.tsx
//
// FW14 increment 6: zero axe violations on every surface the alert list adds.
//
// FIVE SURFACES, and they are not variations of one page: the capture form,
// its success state, its error state, the confirmation outcome and the
// unsubscribe outcome. Each is a different document - different headings,
// different live regions, a different thing in focus - and FW11's lesson
// applies unchanged: an accessible empty form proves very little about the
// same form once it has a status message in it.
//
// WHAT AXE CANNOT SEE HERE, so the green is not read as more than it is. jsdom
// has no layout and CSS modules are identity-mapped, so the :target rule that
// hides five of the six status messages does not apply: axe sees all six. That
// is the right trade for what axe IS checking - labelling, roles, contrast
// tokens, duplicate ids - and the hiding itself is asserted where it can be,
// in the e2e suite against a real browser with real CSS.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import AlertesPage from '@/app/(public)/alertes/page';
import ConfirmationPage from '@/app/(public)/alertes/confirmation/[etat]/page';
import UnsubscribePage from '@/app/(public)/alertes/desinscription/[etat]/page';
import { AlertCapture } from '@/lib/ui/react/AlertCapture/AlertCapture';
import { ALERTES_COPY } from '@/lib/fr/alertes';
import { CONFIRM_STATES, UNSUBSCRIBE_STATES } from '@/lib/alerts/status';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

expect.extend(matchers);

afterEach(cleanup);

/** The outcome pages are async server components; await them into an element. */
const outcome = async (
  Page: (props: { params: Promise<{ etat: string }> }) => Promise<React.ReactElement>,
  etat: string,
): Promise<React.ReactElement> => Page({ params: Promise.resolve({ etat }) });

describe('the capture card has no axe violations', () => {
  it.each(['calculateur', 'alertes', 'guide'] as const)(
    'as source=%s',
    async (source) => {
      const { container } = render(
        <PublicShell>
          <main>
            <AlertCapture source={source} />
          </main>
        </PublicShell>,
      );

      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it('labels its field, rather than leaning on a placeholder', () => {
    // The failure this prevents is specific: a placeholder disappears the
    // moment somebody types, so a reader who looks away has no way back to
    // what the field was for - and a screen reader may not announce it at all.
    render(
      <main>
        <AlertCapture source="calculateur" />
      </main>,
    );

    const field = screen.getByLabelText(ALERTES_COPY.emailLabel);

    expect(field).toBeTruthy();
    expect(field.getAttribute('placeholder')).toBeNull();
  });

  it('gives every status message a role and a name', () => {
    render(
      <main>
        <AlertCapture source="calculateur" />
      </main>,
    );

    const statuses = document.querySelectorAll('[id^="alerte-"][role="status"]');

    // Six: one per ALERT_STATUS. A message with no text would be a live
    // region that announces nothing.
    expect(statuses).toHaveLength(6);

    for (const status of statuses) {
      expect(String(status.textContent).length, status.id).toBeGreaterThan(10);
    }
  });

  it('can be reached and submitted by keyboard, because it is a real form', () => {
    // No click handler, no island: a <form> with a submit button is keyboard
    // operable by construction. Asserted so that turning it into a div with
    // an onClick would fail here rather than in somebody's hands.
    render(
      <main>
        <AlertCapture source="calculateur" />
      </main>,
    );

    const form = document.querySelector('form');

    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe('/api/alertes');
    expect(screen.getByRole('button', { name: ALERTES_COPY.submit })).toBeTruthy();
  });
});

describe('/alertes has no axe violations', () => {
  it('renders clean, under exactly one h1', async () => {
    const { container } = render(
      <PublicShell>
        <AlertesPage />
      </PublicShell>,
    );

    expect(await axe(container)).toHaveNoViolations();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });
});

describe('the outcome pages have no axe violations', () => {
  it.each(Object.values(CONFIRM_STATES))('confirmation/%s', async (etat) => {
    const { container } = render(
      <PublicShell>{await outcome(ConfirmationPage, etat)}</PublicShell>,
    );

    expect(await axe(container)).toHaveNoViolations();

    // Each outcome is its own page with its own h1, because each one has a
    // different next action.
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it.each(Object.values(UNSUBSCRIBE_STATES))('desinscription/%s', async (etat) => {
    const { container } = render(
      <PublicShell>{await outcome(UnsubscribePage, etat)}</PublicShell>,
    );

    expect(await axe(container)).toHaveNoViolations();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('says something different on each outcome', async () => {
    // NON-VACUITY. Five clean axe runs over one identical page would pass
    // every assertion above - which is the shape FW12's state table exists
    // to prevent.
    const headings = new Set<string>();

    for (const etat of Object.values(CONFIRM_STATES)) {
      const { container } = render(
        <PublicShell>{await outcome(ConfirmationPage, etat)}</PublicShell>,
      );

      headings.add(String(container.querySelector('h1')?.textContent));
      cleanup();
    }

    for (const etat of Object.values(UNSUBSCRIBE_STATES)) {
      const { container } = render(
        <PublicShell>{await outcome(UnsubscribePage, etat)}</PublicShell>,
      );

      headings.add(String(container.querySelector('h1')?.textContent));
      cleanup();
    }

    // Three confirmation outcomes and two unsubscribe outcomes, five distinct
    // sentences.
    expect(headings.size).toBe(5);
  });
});
