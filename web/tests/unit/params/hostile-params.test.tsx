// @vitest-environment jsdom
//
// web/tests/unit/params/hostile-params.test.tsx
//
// FW13 increment 6: what arrives when the URL was not written by us.
//
// THE PARAM NAMES BECAME A PUBLIC CONTRACT the moment a link could be pasted
// into a Facebook group, and the corollary is that the VALUES became public
// input. Nobody has to attack this page for it to receive nonsense: the
// platforms do it by themselves. Facebook rewrites "&" as "&amp;" in shared
// text, messaging apps truncate long URLs at a line break, mail clients wrap
// them, and a reader who edits a link by hand produces things no encoder would.
//
// THE BAR, from the prompt: none of this may THROW, BLANK THE PAGE, or produce
// a RESULT PRESENTED AS VALID. Those are three different failures and the third
// is the dangerous one - an exception is visible, a blank page is visible, and
// a confident 38,4 % computed from a value the reader never typed is not.
//
// AND THE NOTICE PRINTS ATTACKER-CONTROLLED TEXT. It names the params that were
// dropped, which means it renders strings that came from the URL. That is the
// right call for the reader (SPEC 9.4, and lib/fr/params.ts argues it), and it
// is also the one place on this page where a stranger chooses what appears on
// screen - so what it does with a script tag and with ten kilobytes is asserted
// here rather than assumed from React's defaults.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { decode, encode } from '@/lib/params/codec';
import { PARAM_NAMES } from '@/lib/params/schema';
import { NOTICE_NAME_MAX } from '@/lib/fr/params';

afterEach(cleanup);

const TAX_YEAR = 2026;
const PATH = '/calculateur-teletravail-frontalier';

/** Land on the page as a reader arriving from a shared link. */
const arriveAt = (search: string) => {
  window.history.replaceState(null, '', `${PATH}${search}`);

  return render(<CalculatorForm taxYear={TAX_YEAR} />);
};

/**
 * The corpus. Each entry is a real way a URL gets damaged between the sender
 * and the reader, not an invented edge case.
 */
const HOSTILE: ReadonlyArray<readonly [string, string]> = [
  ['HTML-entity mangling', '?canton=GE&amp;tt=84'],
  ['double entity mangling', '?canton=GE&amp;amp;tt=84'],
  ['truncated mid-value', '?canton=GE&tt='],
  ['truncated mid-name', '?canton=GE&t'],
  ['truncated to nothing', '?'],
  ['repeated keys', '?canton=GE&canton=VD&tt=84&tt=1'],
  ['absurd magnitude', '?canton=GE&tt=99999999999999999999999'],
  ['exponent notation', '?canton=GE&tt=1e308'],
  ['negative days', '?canton=GE&tt=-84'],
  ['not a number at all', '?canton=GE&tt=quatre-vingt-quatre'],
  ['Arabic-Indic digits', '?canton=GE&tt=٨٤'],
  ['full-width digits', '?canton=GE&tt=８４'],
  ['a null byte', '?canton=GE&tt=84%00'],
  ['whitespace padding', '?canton=GE&tt=%20%2084%20'],
  ['an unknown canton', '?canton=ZZ&tt=84'],
  ['a lower-case canton', '?canton=ge&tt=84'],
  ['every value empty', '?canton=&taux=&tt=&mfr=&mtiers=&methode=&total=&decompte=&debut='],
  ['a tracking parameter', '?canton=GE&tt=84&utm_source=facebook&fbclid=IwAR0'],
  ['ten kilobytes', `?canton=GE&tt=${'9'.repeat(10 * 1024)}`],
  ['a ten-kilobyte NAME', `?canton=GE&tt=84&${'a'.repeat(10 * 1024)}=1`],
  ['markup in a name', '?canton=GE&tt=84&<img src=x onerror=alert(1)>=1'],
  ['markup in a value', '?canton=GE&tt=<script>alert(1)</script>'],
];

describe('decode stays total, whatever arrives', () => {
  it.each(HOSTILE)('%s does not throw', (_label, search) => {
    expect(() => decode(new URLSearchParams(search), TAX_YEAR)).not.toThrow();
  });

  it.each(HOSTILE)('%s yields finite numbers or no input at all', (_label, search) => {
    const { input } = decode(new URLSearchParams(search), TAX_YEAR);

    if (input === null) return;

    // THE THIRD FAILURE, and the quiet one. An Infinity or a NaN reaching the
    // engine produces a result that renders - "NaN %" or a bar chart of
    // nothing - and a reader has no way to tell that from an answer.
    for (const value of Object.values(input)) {
      if (typeof value === 'number') {
        expect(Number.isFinite(value), `${search} -> ${String(value)}`).toBe(true);
      }
    }
  });

  it('never invents a param name, over 5 000 generated queries', () => {
    // The corpus above is a list of things somebody thought of. This is the
    // assertion that does not depend on having thought of them: whatever the
    // query, the names decode reports as IGNORED are names the query actually
    // carried, and the names it reports as INVALID are from the frozen nine.
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.oneof(fc.string(), fc.constantFrom(...PARAM_NAMES)),
            fc.string(),
          ),
          { maxLength: 12 },
        ),
        (pairs) => {
          const params = new URLSearchParams();

          for (const [name, value] of pairs) params.append(name, value);

          const { ignored, invalid, input } = decode(params, TAX_YEAR);
          const present = [...params.keys()];

          for (const name of ignored) expect(present).toContain(name);
          for (const name of invalid) expect(PARAM_NAMES).toContain(name);

          // A name is one or the other, never both: it is either a param this
          // schema knows and could not read, or one it does not know.
          expect(ignored.filter((name) => invalid.includes(name))).toEqual([]);

          if (input !== null) {
            for (const value of Object.values(input)) {
              if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
            }
          }
        },
      ),
      { numRuns: 5_000 },
    );
  });
});

describe('the page renders, whatever arrives', () => {
  it.each(HOSTILE)('%s leaves the form on screen', (_label, search) => {
    // "Does not blank the page" is not "does not throw": a component that
    // catches everything and renders null passes the first and fails this.
    arriveAt(search);

    expect(screen.getByLabelText(CALCULATEUR_COPY.form.canton.label)).toBeTruthy();
    expect(document.querySelector('#resultat')).not.toBeNull();
  });

  it.each(HOSTILE)('%s shows either an answer or the empty state, never neither', (_label, search) => {
    arriveAt(search);

    const region = document.querySelector('#resultat')?.textContent ?? '';

    expect(region.length).toBeGreaterThan(0);

    // Nothing that reads as a computed answer may contain a non-number. This
    // is the "presented as valid" bar, stated as the thing a reader would
    // actually see.
    expect(region).not.toContain('NaN');
    expect(region).not.toContain('Infinity');
    expect(region).not.toContain('undefined');
  });
});

describe('the notice prints what a stranger chose, and prints it as text', () => {
  it('does not execute markup arriving in a param name', () => {
    arriveAt('?canton=GE&tt=84&<img src=x onerror=alert(1)>=1');

    // React escapes by default. This asserts the DEFAULT IS STILL IN FORCE on
    // the one element of this page whose content comes from a stranger - a
    // dangerouslySetInnerHTML added here later would pass every other test in
    // the repository.
    expect(document.querySelectorAll('img')).toHaveLength(0);
    expect(document.querySelectorAll('script')).toHaveLength(0);
    expect(document.body.textContent).toContain('<img');
  });

  it('does not execute markup arriving in a param VALUE', () => {
    arriveAt('?canton=GE&tt=<script>alert(1)</script>');

    expect(document.querySelectorAll('script')).toHaveLength(0);
  });

  it('truncates a name rather than printing ten kilobytes of it', () => {
    // A 10 KB unbroken string in a notice is not a crash and not a blank
    // page, so it clears the prompt's bar - and it would still push the
    // layout sideways at 360 dp, which R127 made a gate. The notice names
    // params so the reader can retype them; a name this long is not a name
    // anybody will retype, so it is cut to something a line can hold.
    const name = 'a'.repeat(10 * 1024);

    arriveAt(`?canton=GE&tt=84&${name}=1`);

    const notice = document.querySelector('[data-notice="params"]')?.textContent ?? '';

    expect(notice.length).toBeGreaterThan(0);
    expect(notice).not.toContain(name);
    expect(notice.length).toBeLessThan(600);

    // And what it DID print is recognisable as the thing that was dropped.
    expect(notice).toContain('a'.repeat(NOTICE_NAME_MAX - 1));
  });

  it('shows the notice for a mangled link and names the right params', () => {
    // The Facebook case, end to end: "&amp;" splits into a param called
    // "amp;tt", so tt never arrives and there is nothing to compute. The
    // reader must be told which name was dropped, or the empty form in front
    // of them is inexplicable.
    arriveAt('?canton=GE&amp;tt=84');

    const notice = document.querySelector('[data-notice="params"]')?.textContent ?? '';

    expect(notice).toContain('amp;tt');
  });
});

describe('the alert status is reserved, not unknown (FW14)', () => {
  // THE COLLISION FW14 FOUND. The subscribe handler cannot use a cookie
  // (SPEC D12 forbids one on a public route) and cannot use an island
  // (R136), so the only way it can tell the reader what happened is to
  // redirect with the status in the URL. Reported as an unknown parameter,
  // that status would make this page greet somebody who had just subscribed
  // with "Ces parametres ne sont pas utilises par le calculateur : alerte".

  it('is neither ignored nor invalid', () => {
    const { ignored, invalid } = decode(
      new URLSearchParams('?canton=GE&tt=84&alerte=ok'),
      TAX_YEAR,
    );

    expect(ignored).toEqual([]);
    expect(invalid).toEqual([]);
  });

  it('shows no notice at all on a link that carries only a status', () => {
    arriveAt(`${'?canton=GE&tt=84&'}alerte=ok`);

    expect(document.querySelector('[data-notice="params"]')).toBeNull();
  });

  it('still reports a genuinely unknown parameter beside it', () => {
    // NON-VACUITY. A codec that stopped reporting unknown names entirely
    // would satisfy both assertions above and lose the notice the whole of
    // FW13 increment 2 exists for.
    const { ignored } = decode(
      new URLSearchParams('?canton=GE&tt=84&alerte=ok&utm_source=facebook'),
      TAX_YEAR,
    );

    expect(ignored).toEqual(['utm_source']);
  });

  it('is never written into a shared link', () => {
    // The status answers one form POST. encode() builds links from the
    // SCENARIO, so a reader who subscribes and then copies the link sends a
    // calculation, not a stale "you have just subscribed".
    const { input } = decode(new URLSearchParams('?canton=GE&tt=84&alerte=ok'), TAX_YEAR);

    expect(input).not.toBeNull();
    expect(encode(input as NonNullable<typeof input>).toString()).not.toContain('alerte');
  });
});
