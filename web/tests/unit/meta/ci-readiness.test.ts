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
import { describeReadiness } from '../../../scripts/ci-readiness.mjs';

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
