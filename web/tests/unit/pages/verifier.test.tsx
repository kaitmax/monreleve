// @vitest-environment jsdom
//
// web/tests/unit/pages/verifier.test.tsx
//
// What the verification page DRAWS. FW-VERIFY (R330).
//
// The lookup test proves the email is never loaded; this proves the renderer
// shows the printed fields, shows the neutral page for an unknown code, carries
// the superseded notice when there is one, and never uses a banned word. It
// renders the pure VerificationContent with a fixed view - no server, no DB.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VerificationContent, type VerificationState } from '@/app/(public)/verifier/[code]/VerificationContent';
import { VERIFICATION_COPY } from '@/lib/fr/verification';
import { DOSSIER_COPY } from '@/lib/fr/dossier';

const VIEW = {
  name: 'Camille Rey',
  taxYear: 2026,
  version: 1,
  declarableRate: 39.16,
  teleworkDays: 94,
  missionDaysFrance: 6,
  missionDaysThirdState: 2,
  periodFraction: 1,
  periodStartDate: null,
  generatedAt: '2026-04-01T09:00:00.000Z',
  supersededAt: null,
} as const;

function textOf(state: VerificationState): string {
  const { container } = render(<VerificationContent state={state} />);

  return container.textContent ?? '';
}

describe('the found state shows the printed fields (R330)', () => {
  it('shows the name, the rate, the days, the missions, the period and the version', () => {
    const text = textOf({ kind: 'found', view: VIEW });

    expect(text).toContain('Camille Rey');
    // 39,16 % with the French no-break space and comma, 2 dp - as printed.
    expect(text).toContain('39,16');
    expect(text).toContain(DOSSIER_COPY.zone.declarableLabel);
    expect(text).toContain(DOSSIER_COPY.tiles.teleworkDays);
    expect(text).toContain(DOSSIER_COPY.annex.kindMissionFrance);
    expect(text).toContain(DOSSIER_COPY.annex.kindMissionThird);
    // The period sentence is the document's own (R181).
    expect(text).toContain(DOSSIER_COPY.header.fullYear(2026));
    expect(text).toContain(VERIFICATION_COPY.version);
  });

  it('vouches that the document is the one issued, without a banned word', () => {
    const text = textOf({ kind: 'found', view: VIEW }).toLowerCase();

    expect(text).toContain('correspond');
    for (const banned of ['certifié', 'attesté', 'conforme', 'validé', 'approuvé']) {
      expect(text, `${banned} appears on the verification page`).not.toContain(banned);
    }
  });

  it('shows the superseded notice ONLY when a newer version exists', () => {
    const current = textOf({ kind: 'found', view: VIEW });
    expect(current).not.toContain('version plus récente');

    const superseded = textOf({
      kind: 'found',
      view: { ...VIEW, supersededAt: '2026-05-02T10:30:00.000Z' },
    });
    expect(superseded).toContain('version plus récente');
    // The newer version's date, by date - never its figures (R330).
    expect(superseded).toContain('02.05.2026');
  });

  it('never shows a former name (R331): it only ever renders the view it is given', () => {
    // The view carries one name. There is no field for a former one, so a former
    // name cannot appear - asserted on a view whose name is the current one.
    const text = textOf({ kind: 'found', view: { ...VIEW, name: 'Camille Martin' } });

    expect(text).toContain('Camille Martin');
    expect(text).not.toContain('Camille Rey');
  });
});

describe('the neutral states (R330)', () => {
  it('shows one neutral message for an unknown or withdrawn code', () => {
    expect(textOf({ kind: 'unknown' })).toContain(VERIFICATION_COPY.unknown);
  });

  it('shows the rate-limit message, which reveals nothing about a code', () => {
    const text = textOf({ kind: 'rate-limited' });

    expect(text).toContain(VERIFICATION_COPY.rateLimited);
    // It must NOT accidentally render the unknown wording, which would hint.
    expect(text).not.toContain(VERIFICATION_COPY.unknown);
  });

  // FW-VERIFIER-OUTAGE (R1022, Web Ruling 20 items 1 and 6): the database could
  // not be reached, so the page looked nothing up and can say nothing about the
  // code or the document - the heading and ONE sentence, the intro dropped.
  it('shows the heading and ONE sentence when the database cannot be reached', () => {
    const { container } = render(<VerificationContent state={{ kind: 'unavailable' }} />);
    const text = container.textContent ?? '';

    expect(container.querySelector('h1')?.textContent).toBe(VERIFICATION_COPY.title);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelector('p')?.textContent).toBe(VERIFICATION_COPY.unavailable);
    expect(container.querySelector('dl')).toBeNull();
    for (const other of [VERIFICATION_COPY.intro, VERIFICATION_COPY.unknown, VERIFICATION_COPY.rateLimited]) {
      expect(text).not.toContain(other);
    }
    for (const banned of ['certifié', 'attesté', 'conforme', 'validé', 'approuvé', 'invalide', 'introuvable']) {
      expect(text.toLowerCase(), `${banned} appears in the unavailable state`).not.toContain(banned);
    }
  });
});

// FW-DOSSIER-EMPTY-3 (R586, closes PARK-H5): THE PAGE'S DATES ARE PARIS DAYS.
//
// The page shows the issue date - in the vouch, in the superseded notice and
// under the document's own "Date de génération" label - as a DATE, never a
// time (R330's subset of what is printed). It printed the instant's UTC date,
// so a relevé issued at 00:30 on 1 January in Paris was "émis le 31.12".
// Now the Paris day: the date the document itself carries.
//
// Paris left summer time at 03:00 on 25 October 2026. Each instant below sits
// half an hour either side of a Paris midnight, so only the right offset lands
// it on the right day: 22:30Z on the 24th is 00:30 on the 25th at UTC+2; 23:30Z
// on the 26th is 00:30 on the 27th at UTC+1, and 22:30Z the same evening is
// still the 26th (23:30) - which a fixed UTC+2 would call the 27th. The dates
// are the assertion (R171).
describe('FW-DOSSIER-EMPTY-3 R586: the dates shown are the Paris day, either side of the DST change', () => {
  it('on 24 October (UTC+2), 22:30Z is already the 25th', () => {
    const text = textOf({
      kind: 'found',
      view: { ...VIEW, generatedAt: '2026-10-24T22:30:00.000Z', supersededAt: '2026-10-24T22:45:00.000Z' },
    });

    expect(text).toContain(VERIFICATION_COPY.vouch('25.10.2026'));
    expect(text).toContain(VERIFICATION_COPY.superseded('25.10.2026'));
    expect(text).toContain(`${DOSSIER_COPY.header.generatedAt}25.10.2026`);
    expect(text).not.toContain('24.10.2026');
  });

  it('on 26 October (UTC+1), 23:30Z is the 27th and 22:30Z still the 26th', () => {
    const late = textOf({ kind: 'found', view: { ...VIEW, generatedAt: '2026-10-26T23:30:00.000Z' } });

    expect(late).toContain(VERIFICATION_COPY.vouch('27.10.2026'));
    expect(late).toContain(`${DOSSIER_COPY.header.generatedAt}27.10.2026`);

    // The control that tells UTC+1 from a fixed UTC+2.
    const evening = textOf({ kind: 'found', view: { ...VIEW, generatedAt: '2026-10-26T22:30:00.000Z' } });

    expect(evening).toContain(VERIFICATION_COPY.vouch('26.10.2026'));
    expect(evening).not.toContain('27.10.2026');
  });
});
