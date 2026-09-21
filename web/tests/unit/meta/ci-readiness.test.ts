// web/tests/unit/meta/ci-readiness.test.ts
//
// R223. The guard that names the private-plus-CI_FULL condition.
//
// WHY THE PURE FUNCTION IS THE SUBJECT. The condition it detects cannot be
// reproduced here without making the repository private, which would be a
// change to the project's state for a test's convenience - and the refusal it
// predicts happens on GitHub's side, where nothing local can observe it. So
// `describeReadiness` is separated from `ciReadiness` precisely so the message
// can be asserted without the state.
//
// That split is the point rather than a convenience: on 19 September the
// message was the thing that went wrong, not the detection. GitHub's billing
// string is emitted both for an exhausted allowance and for a declined card,
// and it was briefly read as a diagnosis of the second.

import { describe, expect, it } from 'vitest';
import { classifyReadiness, describeReadiness } from '../../../scripts/ci-readiness.mjs';

describe('R223: the refusal is named here, not transcribed from a vendor', () => {
  it('names BOTH halves of the condition, because either alone is fine', () => {
    const text = describeReadiness({
      state: 'refused',
      why: 'CI_FULL is on and the repository is PRIVATE',
    });

    // A private repository with CI_FULL unset is the ordinary resting state,
    // and a public one with CI_FULL on is a window. Only the pair refuses, so
    // only the pair is worth naming.
    expect(text).toContain('CI_FULL');
    expect(text).toContain('PRIVATE');
  });

  it('says the push itself is sound, which is the part a reader needs', () => {
    // WITHOUT THIS SENTENCE the message reads as "your work is broken", and the
    // next session spends its time looking at the work. The gate has just
    // passed; what is wrong is downstream of it.
    const text = describeReadiness({ state: 'refused', why: 'x' });

    expect(text).toContain('The push itself is sound');
    // CASE-INSENSITIVE on purpose: the claim is that the message SAYS this,
    // not that it shouts it. Pinning the casing would make a copy edit fail a
    // test about meaning.
    expect(text).toMatch(/not because of a test/iu);
  });

  it('refuses to let the billing string be read as a diagnosis', () => {
    // THE ACTUAL DEFECT OF 19 SEPTEMBER. The message must say that GitHub's
    // sentence covers two different causes, or the next reader does what the
    // last one did and treats it as evidence of a failed payment.
    const text = describeReadiness({ state: 'refused', why: 'x' });

    expect(text).toContain('exhausted allowance');
    expect(text).toContain('declined card');
    expect(text).toContain('not a');
  });

  it('gives the one command that fixes it', () => {
    // A refusal that does not say what to do next is a refusal somebody works
    // around. R179's other half: label the rule AND the remedy.
    expect(describeReadiness({ state: 'refused', why: 'x' })).toContain(
      'gh variable delete CI_FULL',
    );
  });

  it('reports UNKNOWN as a state rather than passing quietly (R133)', () => {
    const text = describeReadiness({ state: 'unknown', why: 'gh is not authenticated' });

    expect(text).toContain('UNKNOWN');
    expect(text).toContain('gh is not authenticated');

    // AND SAYS IT IS NOT A FAILURE, so an unauthenticated machine does not
    // read this as a broken gate.
    expect(text).toContain('Not a failure');
  });

  it('does not shout on the states that are fine', () => {
    // The loud form is reserved for the one case that costs something. A guard
    // that warns on every run is a guard nobody reads.
    for (const state of ['ready', 'quiet'] as const) {
      const text = describeReadiness({ state, why: 'whatever' });

      expect(text).not.toContain('WILL REFUSE');
      expect(text).toContain('CI readiness');
    }
  });
});

describe('R233: the answer is parsed strictly, and an ambiguous one is UNKNOWN', () => {
  // ==========================================================================
  // THE LIVE DEFECT THIS WAS WRITTEN FOR
  // ==========================================================================
  //
  // On 22 September this guard printed `the repository is public` for a
  // repository that is PRIVATE, and printed `private` for the same repository
  // an hour later with nothing about it changed. `gh repo view --json isPrivate
  // --jq .isPrivate` had answered something that was neither `true` nor
  // `false` - most plausibly the empty string, which is what `--jq` yields when
  // it matches nothing - and `visibility === 'true'` read that as FALSE and
  // therefore as PUBLIC.
  //
  // THE DEFAULT WAS THE PERMISSIVE ONE, in the guard whose whole job is to
  // catch an expensive condition. R205's shape on a console line: a claim
  // emitted because the answer could be PARSED rather than because it could be
  // BELIEVED. The header above explains why `ciReadiness` is not tested - the
  // CONDITION cannot be reproduced locally - and that is true of the condition
  // and false of the PARSING, which is pure. R175: two sides examined and the
  // space between them, which is where this lived.
  //
  // A wrong reading here is not cosmetic. It told a report that the repository
  // was public, and that report corrected the operator's own prompt on it.

  it('reads true as private', () => {
    expect(classifyReadiness('true', '').state).toBe('quiet');
  });

  it('reads false as public, so the strictness is not refusing everything', () => {
    // R196: rejection alone proves a parser is STRICT, never that it is RIGHT.
    expect(classifyReadiness('false', '').state).toBe('ready');
  });

  it('refuses when CI_FULL is on and the repository is private', () => {
    expect(classifyReadiness('true', 'CI_FULL\ton\t2026-09-01').state).toBe('refused');
  });

  it('calls an EMPTY answer unknown, which is the defect that produced this', () => {
    // Today this returns `ready` and says "the repository is public".
    expect(classifyReadiness('', '').state).toBe('unknown');
  });

  it.each(['null', 'undefined', 'TRUE', 'yes', '{"isPrivate":true}'])(
    'calls %s unknown rather than guessing',
    (answer) => {
      expect(classifyReadiness(answer, '').state).toBe('unknown');
    },
  );

  it('names what it actually got, so the next reader is not left guessing', () => {
    // R198: the refusal names which rule fired. A bare "unknown" sends somebody
    // to check their gh auth when the real answer is that gh replied oddly.
    const { why } = classifyReadiness('yes', '');

    expect(why).toContain('yes');
  });
});
