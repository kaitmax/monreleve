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
});
