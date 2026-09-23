// web/tests/unit/push/classify.test.ts
//
// The whitelist that decides whether a device row survives. FW27 increment 3.
//
// ============================================================================
// WHY THIS IS SWEPT RATHER THAN SAMPLED
// ============================================================================
//
// A table of "503 does not prune, 500 does not prune, 429 does not prune"
// proves the statuses somebody thought of. The failure this guards against is
// a status NOBODY thought of - a proxy's 502, a future 451, a 409 from a
// vendor change - being read as "the token is gone" and silently deleting a
// person's registration.
//
// So the assertion is over the whole space: every status from 100 to 599 is
// classified, and exactly two of them prune. A change that widened the rule
// would fail here with the status it added, rather than passing because the
// table did not happen to contain it.
//
// R196's both-directions rule: a classifier that answered `undelivered` to
// everything would pass a prune-nothing test perfectly, so 404 and 410 are
// asserted to prune and 200 to deliver in the same sweep.

import { describe, expect, it } from 'vitest';
import { DEAD_TOKEN_STATUSES, classifyPushStatus } from '@/lib/push/sender';

const ALL_STATUSES = Array.from({ length: 500 }, (_, index) => index + 100);

describe('a status is read as a fact about the token, not about the request', () => {
  it('prunes on exactly two statuses in the whole space, and they are 404 and 410', () => {
    const pruning = ALL_STATUSES.filter((status) => classifyPushStatus(status) === 'token_dead');

    expect(pruning).toEqual([404, 410]);
    expect(pruning).toEqual([...DEAD_TOKEN_STATUSES]);
  });

  it('treats every 2xx as delivered, so the rule is not simply refusing', () => {
    const delivered = ALL_STATUSES.filter((status) => classifyPushStatus(status) === 'delivered');

    expect(delivered).toHaveLength(100);
    expect(delivered[0]).toBe(200);
    expect(delivered.at(-1)).toBe(299);
  });

  it('keeps the row on every other status, named ones included', () => {
    // THESE ARE THE ONES THAT LOOK PERMANENT AND ARE NOT FACTS ABOUT THE
    // TOKEN. A credential outage answers 401 for every device this product
    // has; a quota answers 429; a bad envelope answers 400. Pruning on any of
    // them deletes every registration in one run, and nothing tells the people
    // it happened to.
    for (const status of [400, 401, 403, 409, 429, 451, 500, 502, 503, 504]) {
      expect(classifyPushStatus(status), `${status} must not prune`).toBe('undelivered');
    }
  });

  it('classifies the whole space into exactly three outcomes and no undefined', () => {
    // The sweep above filters; this one asserts nothing fell through. A
    // classifier returning undefined for an unanticipated status would satisfy
    // both filters and be caught only here.
    const outcomes = new Set(ALL_STATUSES.map((status) => classifyPushStatus(status)));

    expect([...outcomes].sort()).toEqual(['delivered', 'token_dead', 'undelivered']);
  });
});
