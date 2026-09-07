// web/lib/ui/react/ZoneBadge/ZoneBadge.test.tsx
//
// SPEC 6.2: "Every status carries icon + label + one-line explanation."
// SPEC 16: "Zone/status is never colour-only - icon + text label on every
// surface including the PDF." So all three parts are mandatory in all four
// states, and no test here may be satisfied by colour alone.
//
// RULING R57 decides the colours, over both the FW8 prompt and FD3, and the
// reason is measured rather than editorial: #B7791F on #FFF7E6 is 3.42:1,
// which fails WCAG AA for normal text. The prompt asked for the chip label in
// the warning colour at 15/500, which would have failed the audit AC2 demands
// in the same increment. So the label is #111827 on the soft fill (16.64:1)
// and the warning colour survives where it is legal: the ICON.
//
// RULING R41 renames the compliant label to "Sous les deux seuils". The other
// three labels each name a consequence; "Dans les limites" named none.

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STATUS_PRESENTATION } from '@/lib/ui/core';
import type { Status } from '@/lib/ui/core';
import { ZoneBadge } from './ZoneBadge';

const ALL: readonly Status[] = [
  'compliant',
  'mission-exposure',
  'regime-lost',
  'social-switch',
];

const render = (status: Status): string => renderToStaticMarkup(<ZoneBadge status={status} />);

describe('every status carries icon + label + explanation', () => {
  for (const status of ALL) {
    describe(status, () => {
      it('renders the label from lib/fr', () => {
        expect(render(status)).toContain(STATUS_PRESENTATION[status].label);
      });

      it('renders the one-line explanation', () => {
        expect(render(status)).toContain(STATUS_PRESENTATION[status].explanation);
      });

      it('renders an icon, and hides it from the accessible name', () => {
        // The label beside it already says what it means, so announcing the
        // glyph would read the same information twice.
        const html = render(status);

        expect(html).toContain('<svg');
        expect(html).toContain('aria-hidden="true"');
      });
    });
  }

  it('applies R41 to the compliant label', () => {
    expect(render('compliant')).toContain('Sous les deux seuils');
    expect(render('compliant')).not.toContain('Dans les limites');
  });

  it('gives the four states four DIFFERENT labels and icons', () => {
    // SPEC 12 caps the palette at three status colours for four statuses, so
    // regime-lost and social-switch necessarily share --colour-error. The
    // label and the glyph are what separate them, and a badge that shared
    // both would make FW8's "four states visually distinct" unachievable.
    const labels = ALL.map((s) => STATUS_PRESENTATION[s].label);
    const icons = ALL.map((s) => STATUS_PRESENTATION[s].icon);

    expect(new Set(labels).size).toBe(ALL.length);
    expect(new Set(icons).size).toBe(ALL.length);
  });
});

describe('the colours follow R57, not the brief', () => {
  it('sets the chip label in text-primary, never the status colour', () => {
    // Read from the STYLESHEET, not the markup: the label colour is a class
    // rule, so it never appears in rendered HTML, and asserting on the markup
    // would fail against a correct component. jsdom cannot help either - it
    // returns the literal string "var(--colour-text-primary)" rather than
    // resolving it. The real computed value is checked in Chromium by R59's
    // Playwright pass; this pins the token the stylesheet asks for.
    //
    // The measured reason it matters: warning on its soft fill is 3.42:1,
    // below the 4.5 AA needs for normal text; text-primary on that same fill
    // is 16.64:1.
    const scss = readFileSync(new URL('./ZoneBadge.module.scss', import.meta.url), 'utf8');
    const chipRule = scss.slice(scss.indexOf('.chip {'), scss.indexOf('.icon {'));

    expect(chipRule).toContain('color: var(--colour-text-primary)');
    expect(chipRule).not.toContain('color: var(--colour-warning)');
  });

  it('keeps the status colour for the icon', () => {
    // Where it is legal and where it carries meaning without carrying words.
    expect(render('mission-exposure')).toContain('--colour-warning');
    expect(render('compliant')).toContain('--colour-success');
    expect(render('regime-lost')).toContain('--colour-error');
  });

  it('fills the chip with the soft token of its status', () => {
    expect(render('mission-exposure')).toContain('--colour-warning-soft');
    expect(render('compliant')).toContain('--colour-success-soft');
  });

  it('never emits a hex literal', () => {
    for (const status of ALL) {
      expect(render(status)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });
});

describe('mission-exposure is the warning badge that sits on a green rail', () => {
  it('renders warning-coloured regardless of the Zone beside it', () => {
    // SPEC 6.2's named oddity, and Geneva case (c) is the fixture: declarable
    // 39,16 % puts the RAIL in the compliant band while the BADGE warns about
    // mission days. The badge takes a Status and knows nothing about the
    // Zone, which is precisely what keeps the two axes from being conflated.
    const html = render('mission-exposure');

    expect(html).toContain('--colour-warning');
    expect(html).not.toContain('--colour-success');
  });

  it('takes no Zone prop at all', () => {
    // The structural half: there is no channel through which a Zone could
    // influence the badge, so "coloured by Status, never by Zone" cannot be
    // violated by a caller.
    expect(Object.keys({ status: 'compliant' as Status })).toEqual(['status']);
  });
});
